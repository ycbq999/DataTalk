import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSymbol, readWatchlist } from './watchlist.ts';

test('normalizes a symbol and accepts common exchange and share-class suffixes', () => {
  assert.equal(parseSymbol(' shop.to '), 'SHOP.TO');
  assert.equal(parseSymbol('brk.b'), 'BRK.B');
  assert.equal(parseSymbol('not a stock'), null);
  assert.equal(parseSymbol('TOO-LONG-A-TICKER'), null);
});

test('restores notes even after the last symbol has been removed', () => {
  const watchlist = { symbols: [], notes: { NVDA: 'Read the next filing.' } };
  assert.deepEqual(readWatchlist(JSON.stringify(watchlist)), watchlist);
  assert.deepEqual(readWatchlist('invalid JSON').symbols, ['NVDA', 'QCOM', 'HPE']);
});
