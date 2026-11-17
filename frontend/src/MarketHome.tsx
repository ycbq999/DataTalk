import { ArrowRight, Bookmark, List, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, request } from './api';
import type { Security } from './api';

function exchangeName(exchange: string) {
  if (exchange === 'XNAS') return 'Nasdaq';
  if (exchange === 'XNYS') return 'NYSE';
  return exchange;
}

export function MarketHome({ signedIn }: { signedIn: boolean }) {
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
        <h1 id="market-title">Explore stocks</h1>
        <p>Find the companies you follow and build a workspace for your investment research.</p>
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

        <aside className="panel market-workspace" aria-labelledby="market-workspace-title">
          <div className="market-workspace-icon"><Bookmark size={20} aria-hidden="true" /></div>
          <h2 id="market-workspace-title">Your research workspace</h2>
          <p>Save custom watchlists and notes, then revisit your investment theses and their sources.</p>
          <a className="button button-primary" href={signedIn ? '/workspace/' : '/sign-up/'}>
            {signedIn ? 'Open workspace' : 'Create an account'} <ArrowRight size={16} aria-hidden="true" />
          </a>
        </aside>
      </div>
    </main>
  );
}
