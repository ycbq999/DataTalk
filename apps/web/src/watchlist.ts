export interface Watchlist {
  symbols: string[];
  notes: Record<string, string>;
}

export const watchlistKey = 'thesiswatch.watchlist.v1';
export const noteLimit = 2000;

const defaultSymbols = ['NVDA', 'QCOM', 'HPE'];

export function parseSymbol(input: string): string | null {
  const symbol = input.trim().toUpperCase();
  return symbol.length <= 15 && /^[A-Z0-9]+(?:[.-][A-Z0-9]+)*$/.test(symbol)
    ? symbol
    : null;
}

export function readWatchlist(value: string | null): Watchlist {
  if (value) {
    try {
      const saved = JSON.parse(value);
      if (Array.isArray(saved?.symbols)) {
        const symbols = saved.symbols.filter(
          (symbol: unknown): symbol is string =>
            typeof symbol === 'string' && parseSymbol(symbol) === symbol,
        );
        const notes = Object.fromEntries(
          Object.entries(saved.notes ?? {}).filter(
            ([symbol, note]) =>
              parseSymbol(symbol) === symbol && typeof note === 'string' && note.length <= noteLimit,
          ),
        ) as Watchlist['notes'];
        return { symbols: [...new Set<string>(symbols)], notes };
      }
    } catch {
      // An unreadable record is treated as a fresh watchlist.
    }
  }

  return { symbols: [...defaultSymbols], notes: {} };
}
