import { CornerUpRight, List, Search, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, request } from './api';
import type { Security } from './api';

const sampleMovers = [
  { kind: 'loss', label: 'Top Loss', icon: TrendingDown, symbol: 'INTC', name: 'Intel', change: -0.386 },
  { kind: 'gain', label: 'Top Gains', icon: TrendingUp, symbol: 'NVDA', name: 'NVIDIA', change: 0.824 },
  { kind: 'rebound', label: 'Top Rebound', icon: CornerUpRight, symbol: 'AMD', name: 'Advanced Micro Devices', change: 0.612 },
] as const;

const sampleEvents = [
  { title: 'GTA VI release', category: 'Gaming', day: 6 },
  { title: 'SpaceX Starship test flight', category: 'Spaceflight', day: 14 },
  { title: 'U.S. inflation report', category: 'Economy', day: 23 },
] as const;

const formatChange = new Intl.NumberFormat('en-US', {
  style: 'percent',
  signDisplay: 'exceptZero',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function exchangeName(exchange: string) {
  if (exchange === 'XNAS') return 'Nasdaq';
  if (exchange === 'XNYS') return 'NYSE';
  return exchange;
}

export function MarketHome() {
  const [query, setQuery] = useState('');
  const [exchange, setExchange] = useState('');
  const [exchanges, setExchanges] = useState<string[]>([]);
  const [result, setResult] = useState<{ filter: string; securities: Security[]; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const filter = new URLSearchParams({ q: term, exchange }).toString();
  const current = result?.filter === filter ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const securities = await request<Security[]>(`market/securities/?${filter}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResult({ filter, securities, error: '' });
          setExchanges((previous) => Array.from(new Set([...previous, ...securities.map((security) => security.exchange)])).sort());
        }
      } catch (error) {
        if (!controller.signal.aborted) setResult({ filter, securities: [], error: errorMessage(error) });
      }
    }, term ? 180 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, filter, term]);

  return (
    <main id="main" className="market-home">
      <section className="market-hero" aria-labelledby="market-title">
        <h1 id="market-title">Top Stories</h1>
        <p>Search the stock directory and preview one-year market movers.</p>
        <div className="market-search" role="search" aria-label="Stock catalog">
          <label className="sr-only" htmlFor="market-search">Search stocks</label>
          <Search size={19} aria-hidden="true" />
          <input
            id="market-search"
            ref={searchInput}
            type="search"
            value={query}
            maxLength={160}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ticker or company name"
            autoComplete="off"
          />
          {query && <button className="button button-icon" type="button" aria-label="Clear stock search" onClick={() => {
            setQuery('');
            searchInput.current?.focus();
          }}>
            <X size={17} aria-hidden="true" />
          </button>}
        </div>
      </section>

      <div className="market-grid">
        <section className="panel market-directory" aria-labelledby="directory-title">
          <div className="panel-header market-directory-header">
            <div>
              <h2 id="directory-title"><List size={18} aria-hidden="true" /> Stock directory</h2>
              <p>Listing information only. Live prices aren’t available.</p>
            </div>
            <label className="sr-only" htmlFor="market-exchange">Filter by exchange</label>
            <select id="market-exchange" value={exchange} onChange={(event) => setExchange(event.target.value)}>
              <option value="">All exchanges</option>
              {exchanges.map((value) => <option key={value} value={value}>{exchangeName(value)}</option>)}
            </select>
          </div>
          {!current ? (
            <p className="market-empty muted" role="status">Loading stocks…</p>
          ) : current.error ? (
            <div className="market-empty">
              <p className="notice notice-error" role="alert">{current.error}</p>
              <button className="button button-secondary" type="button" onClick={() => {
                setResult(null);
                setAttempt((value) => value + 1);
              }}>Try again</button>
            </div>
          ) : current.securities.length === 0 ? (
            <p className="market-empty muted" role="status">No stocks match your search.</p>
          ) : (
            <>
              <p className="sr-only" role="status">{current.securities.length} stocks shown.</p>
              <table className="market-table">
                <thead>
                  <tr><th scope="col">Symbol</th><th scope="col">Company</th><th scope="col">Exchange</th></tr>
                </thead>
                <tbody>
                  {current.securities.map((security) => (
                    <tr key={security.id}>
                      <th scope="row"><span className="market-symbol">
                        <span className="security-mark" aria-hidden="true">{security.symbol.slice(0, 1)}</span>
                        {security.symbol}
                      </span></th>
                      <td>{security.name}</td>
                      <td><span title={security.exchange} className="soft-pill exchange">{exchangeName(security.exchange)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="market-result-note">
                Showing {current.securities.length} {current.securities.length === 1 ? 'stock' : 'stocks'} from the ThesisWatch catalog.
              </p>
            </>
          )}
        </section>

        <div className="market-sidebar">
          <aside className="panel market-movers" aria-labelledby="market-movers-title">
            <div className="panel-header">
              <h2 id="market-movers-title">One-year movers</h2>
              <span className="market-sample-label">Sample data</span>
            </div>
            {sampleMovers.map(({ kind, label, icon: Icon, symbol, name, change }) => (
              <div className="market-mover" key={kind} data-kind={kind}>
                <h3><span className="market-mover-icon"><Icon size={16} aria-hidden="true" /></span>{label}</h3>
                <div className="market-mover-quote">
                  <div>
                    <strong>{symbol}</strong>
                    <p>{name}</p>
                  </div>
                  <strong className="market-mover-change">{formatChange.format(change)}</strong>
                </div>
                {kind === 'rebound' && <p className="market-mover-basis">From the 12-month low</p>}
              </div>
            ))}
          </aside>

          <aside className="panel market-events" aria-labelledby="market-events-title">
            <div className="panel-header">
              <h2 id="market-events-title">Next 30 Days</h2>
              <span className="market-sample-label">Sample schedule</span>
            </div>
            <ol className="market-event-list" role="list">
              {sampleEvents.map(({ title, category, day }) => (
                <li key={title}>
                  <p className="market-event-meta"><span>{category}</span><span>Day {day}</span></p>
                  <h3>{title}</h3>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </main>
  );
}
