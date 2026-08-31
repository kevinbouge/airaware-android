import { REQUEST_TIMEOUT_MS } from '../../core/constants';
import type {
  HealthGeography,
  HealthSignal,
  HealthSignalProviderResult,
  HealthSignalType,
} from '../../models/healthSignals';

class HealthProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly kind: 'http' | 'timeout' | 'network' = status === undefined
      ? 'network'
      : 'http',
  ) {
    super(message);
  }
}

export class HealthProviderSchemaError extends Error {}

function providerErrorDetails(error: unknown):
  | {
      providerErrorKind: 'http' | 'timeout' | 'schema' | 'network' | 'unknown';
      providerStatusCode?: number | undefined;
      providerDiagnostic?: string | undefined;
    }
  | undefined {
  if (error === undefined) return undefined;

  if (error instanceof HealthProviderSchemaError) {
    return {
      providerErrorKind: 'schema',
      providerDiagnostic: error.message,
    };
  }

  if (error instanceof HealthProviderRequestError) {
    return {
      providerErrorKind: error.kind,
      providerStatusCode: error.status,
      providerDiagnostic: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      providerErrorKind: 'network',
      providerDiagnostic: error.message,
    };
  }

  return {
    providerErrorKind: 'unknown',
    providerDiagnostic: String(error),
  };
}

async function fetchHealthResponse(
  url: string,
  accept: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: accept },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HealthProviderRequestError(`HTTP ${response.status}`, response.status);
    }

    return response;
  } catch (error) {
    if (error instanceof HealthProviderRequestError) throw error;
    if (error instanceof Error) {
      throw new HealthProviderRequestError(
        error.name === 'AbortError' ? 'Request timed out' : error.message,
        undefined,
        error.name === 'AbortError' ? 'timeout' : 'network',
      );
    }

    throw new HealthProviderRequestError('Network request failed');
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBodyWithTimeout<T>(
  readBody: () => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new HealthProviderRequestError('Request timed out', undefined, 'timeout')),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([readBody(), timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchHealthJson<T>(url: string, timeoutMs?: number): Promise<T> {
  const response = await fetchHealthResponse(url, 'application/json', timeoutMs);
  try {
    return (await readResponseBodyWithTimeout(() => response.json(), timeoutMs)) as T;
  } catch (error) {
    if (error instanceof HealthProviderRequestError) throw error;
    throw new HealthProviderSchemaError(
      error instanceof Error ? `Invalid JSON response: ${error.message}` : 'Invalid JSON response',
    );
  }
}

export async function fetchHealthText(url: string, timeoutMs?: number): Promise<string> {
  const response = await fetchHealthResponse(
    url,
    'text/csv, text/plain, application/octet-stream, */*',
    timeoutMs,
  );
  return readResponseBodyWithTimeout(() => response.text(), timeoutMs);
}

export function providerErrorSignal(input: {
  id: string;
  domain: HealthSignal['domain'];
  type: HealthSignalType;
  geography: HealthGeography;
  now: string;
  source: HealthSignal['source'];
  reason: string;
  error?: unknown;
}): HealthSignal {
  const details = providerErrorDetails(input.error);

  return {
    id: input.id,
    domain: input.domain,
    type: input.type,
    geography: input.geography,
    updatedAt: input.now,
    category: 'unknown',
    trend: 'unknown',
    source: input.source,
    freshness: { status: 'stale', ageMs: Number.POSITIVE_INFINITY },
    metadata: {
      unavailable: true,
      providerStatus: 'provider-error',
      reason: input.reason,
      ...details,
    },
  };
}

function signalStatus(signal: HealthSignal): 'available' | 'no-data' | 'provider-error' {
  if (signal.metadata?.providerStatus === 'provider-error') return 'provider-error';
  if (signal.metadata?.unavailable === true) return 'no-data';
  return 'available';
}

export function signalProviderStatus(
  signal: HealthSignal,
): NonNullable<HealthSignalProviderResult['signalStatuses']>[number] {
  const metadata = signal.metadata ?? {};
  const providerErrorKind =
    metadata.providerErrorKind === 'http' ||
    metadata.providerErrorKind === 'timeout' ||
    metadata.providerErrorKind === 'schema' ||
    metadata.providerErrorKind === 'network' ||
    metadata.providerErrorKind === 'unknown'
      ? metadata.providerErrorKind
      : undefined;
  const providerStatusCode =
    typeof metadata.providerStatusCode === 'number' ? metadata.providerStatusCode : undefined;
  const providerDiagnostic =
    typeof metadata.providerDiagnostic === 'string' ? metadata.providerDiagnostic : undefined;

  return {
    type: signal.type,
    status: signalStatus(signal),
    ...(typeof metadata.reason === 'string' ? { reason: metadata.reason } : {}),
    ...(providerErrorKind ? { providerErrorKind } : {}),
    ...(providerStatusCode === undefined ? {} : { providerStatusCode }),
    ...(providerDiagnostic ? { providerDiagnostic } : {}),
  };
}
