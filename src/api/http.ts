import { REQUEST_TIMEOUT_MS } from '../core/constants';

class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new ProviderError(`HTTP ${response.status}`, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new ProviderError(error.message);
    }

    throw new ProviderError('Network request failed');
  } finally {
    clearTimeout(timeout);
  }
}
