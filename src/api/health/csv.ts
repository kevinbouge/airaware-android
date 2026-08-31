interface QuoteState {
  index: number;
  inQuotes: boolean;
  field: string;
}

interface ParserState extends QuoteState {
  rows: string[][];
  row: string[];
}

function handleQuote(input: string, state: QuoteState): QuoteState {
  const next = input[state.index + 1];
  if (state.inQuotes && next === '"') {
    return { ...state, index: state.index + 1, field: `${state.field}"` };
  }

  return { ...state, inQuotes: !state.inQuotes };
}

function isLineBreak(char: string | undefined): boolean {
  return char === '\n' || char === '\r';
}

function pushField(state: ParserState): void {
  state.row.push(state.field);
  state.field = '';
}

function pushRow(state: ParserState): void {
  pushField(state);
  if (state.row.some((value) => value.length > 0)) state.rows.push(state.row);
  state.row = [];
}

function advanceQuote(input: string, state: ParserState): void {
  const nextState = handleQuote(input, state);
  state.index = nextState.index + 1;
  state.inQuotes = nextState.inQuotes;
  state.field = nextState.field;
}

function advanceLineBreak(input: string, state: ParserState): void {
  const char = input[state.index];
  const next = input[state.index + 1];
  if (char === '\r' && next === '\n') state.index += 1;
  pushRow(state);
  state.index += 1;
}

function parseDelimitedRows(input: string, delimiter = ','): string[][] {
  const state: ParserState = {
    rows: [],
    row: [],
    field: '',
    inQuotes: false,
    index: 0,
  };

  while (state.index < input.length) {
    const char = input[state.index];
    if (char === '"') {
      advanceQuote(input, state);
      continue;
    }

    if (char === delimiter && !state.inQuotes) {
      pushField(state);
      state.index += 1;
      continue;
    }

    if (isLineBreak(char) && !state.inQuotes) {
      advanceLineBreak(input, state);
      continue;
    }

    state.field += char;
    state.index += 1;
  }

  pushRow(state);
  return state.rows;
}

export function delimitedRecords(input: string, delimiter = ','): Record<string, string>[] {
  const [headers, ...rows] = parseDelimitedRows(input, delimiter);
  if (!headers) return [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), row[index]?.trim() ?? ''])),
  );
}
