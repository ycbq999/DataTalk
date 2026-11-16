import { healthPath } from '@thesiswatch/shared';
import type { HealthResponse } from '@thesiswatch/shared';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { noteLimit, parseSymbol, readWatchlist, watchlistKey } from './watchlist.ts';
import type { Watchlist } from './watchlist.ts';

const companyNames: Partial<Record<string, string>> = {
  NVDA: 'NVIDIA',
  QCOM: 'Qualcomm',
  HPE: 'Hewlett Packard Enterprise',
};

const apiLabels = {
  checking: 'Checking API',
  online: 'API online',
  offline: 'API offline',
};

function ApiStatus() {
  const [status, setStatus] = useState<keyof typeof apiLabels>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setStatus('offline');
    }, 5000);

    async function check() {
      try {
        const response = await fetch(healthPath, { cache: 'no-store', signal: controller.signal });
        const body: Partial<HealthResponse> | null = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) setStatus(body?.status === 'ok' ? 'online' : 'offline');
      } catch {
        if (!controller.signal.aborted) setStatus('offline');
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void check();
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  return (
    <button
      className="api-status"
      data-status={status}
      type="button"
      title="Check API status"
      onClick={() => {
        setStatus('checking');
        setAttempt((current) => current + 1);
      }}
    >
      <span className="status-dot" aria-hidden="true" />
      <span aria-live="polite">{apiLabels[status]}</span>
    </button>
  );
}

function ResearchNote({
  note,
  onSave,
}: {
  note: string;
  onSave: (note: string) => boolean;
}) {
  const [draft, setDraft] = useState(note);
  const [message, setMessage] = useState('');

  return (
    <form
      className="note-form"
      onSubmit={(event) => {
        event.preventDefault();
        const next = draft.trim();
        setDraft(next);
        setMessage(onSave(next) ? 'Note saved.' : 'Note updated for this session.');
      }}
    >
      <label className="field-label" htmlFor="research-note">
        Your research note
      </label>
      <textarea
        id="research-note"
        rows={4}
        maxLength={noteLimit}
        placeholder="What are you watching, and what would change your view?"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setMessage('');
        }}
      />
      <div className="note-actions">
        <span className="form-message" role="status">{message}</span>
        <button className="button button-secondary" type="submit" disabled={draft.trim() === note}>
          Save note
        </button>
      </div>
    </form>
  );
}

function loadWatchlist() {
  try {
    return readWatchlist(window.localStorage.getItem(watchlistKey));
  } catch {
    return readWatchlist(null);
  }
}

export function App() {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [activeSymbol, setActiveSymbol] = useState(watchlist.symbols[0] ?? null);
  const [input, setInput] = useState('');
  const [symbolError, setSymbolError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);

  function updateWatchlist(next: Watchlist) {
    setWatchlist(next);
    try {
      window.localStorage.setItem(watchlistKey, JSON.stringify(next));
      setStorageWarning(false);
      return true;
    } catch {
      setStorageWarning(true);
      return false;
    }
  }

  function addSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = parseSymbol(input);
    if (!symbol) {
      setSymbolError('Enter a ticker like MSFT or SHOP.TO, up to 15 characters.');
      return;
    }
    if (watchlist.symbols.includes(symbol)) {
      setSymbolError(`${symbol} is already on your watchlist.`);
      return;
    }
    updateWatchlist({ ...watchlist, symbols: [...watchlist.symbols, symbol] });
    setActiveSymbol(symbol);
    setInput('');
    setSymbolError('');
  }

  function removeSymbol(symbol: string, index: number) {
    const symbols = watchlist.symbols.filter((item) => item !== symbol);
    updateWatchlist({ ...watchlist, symbols });
    if (symbol === activeSymbol) setActiveSymbol(symbols[index] ?? symbols.at(-1) ?? null);
  }

  return (
    <>
      <header className="topbar">
        <div className="page-width flex items-center justify-between gap-3">
          <div className="wordmark">
            <span className="brand-icon" aria-hidden="true">↗</span>
            <span>Thesis<span className="brand-accent">Watch</span></span>
          </div>
          <ApiStatus />
        </div>
      </header>

      <main className="page-width">
        <div className="page-intro">
          <h1>Research dashboard</h1>
          <p>Your watchlist and research notes are saved in this browser.</p>
        </div>
        {storageWarning && (
          <p className="storage-warning" role="alert">
            Browser storage is unavailable. Changes will be lost when you reload.
          </p>
        )}

        <div className="dashboard-grid">
          <section className="panel" aria-labelledby="watchlist-heading">
            <div className="panel-heading">
              <h2 id="watchlist-heading">Watchlist</h2>
              <span className="symbol-count">
                {watchlist.symbols.length} {watchlist.symbols.length === 1 ? 'symbol' : 'symbols'}
              </span>
            </div>

            <form className="symbol-form" onSubmit={addSymbol}>
              <label className="field-label" htmlFor="ticker">Ticker symbol</label>
              <div className="flex gap-2">
                <input
                  id="ticker"
                  placeholder="e.g. MSFT"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="characters"
                  value={input}
                  aria-invalid={symbolError ? true : undefined}
                  aria-describedby={symbolError ? 'ticker-error' : undefined}
                  onChange={(event) => {
                    setInput(event.target.value);
                    setSymbolError('');
                  }}
                />
                <button className="button button-primary" type="submit">Add ticker</button>
              </div>
              {symbolError && <p id="ticker-error" className="field-error" role="alert">{symbolError}</p>}
            </form>

            {watchlist.symbols.length === 0 ? (
              <p className="empty-watchlist">Add a ticker to start your watchlist.</p>
            ) : (
              <ul className="symbol-list" aria-label="Tracked symbols">
                {watchlist.symbols.map((symbol, index) => (
                  <li className="symbol-row" data-selected={symbol === activeSymbol} key={symbol}>
                    <button
                      className="symbol-select"
                      type="button"
                      aria-pressed={symbol === activeSymbol}
                      onClick={() => setActiveSymbol(symbol)}
                    >
                      <span className="symbol-icon" aria-hidden="true">{symbol.slice(0, 2)}</span>
                      <span>
                        <span className="symbol-name">{symbol}</span>
                        {Object.hasOwn(companyNames, symbol) && (
                          <span className="company-name">{companyNames[symbol]}</span>
                        )}
                      </span>
                    </button>
                    <button className="symbol-remove" type="button" aria-label={`Remove ${symbol}`}
                      onClick={() => removeSymbol(symbol, index)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel research-panel" aria-labelledby="research-heading">
            <div className="panel-heading">
              <h2 id="research-heading">Research</h2>
            </div>
            {activeSymbol ? (
              <>
                <div className="research-symbol">
                  <h3>{activeSymbol}</h3>
                  {Object.hasOwn(companyNames, activeSymbol) && <p>{companyNames[activeSymbol]}</p>}
                </div>
                {activeSymbol === 'NVDA' && (
                  <div className="example-thesis">
                    <h4>Sample thesis</h4>
                    <dl>
                      <div>
                        <dt>Bull case</dt>
                        <dd>Demand for AI infrastructure could support growth if customers keep expanding capacity.</dd>
                      </div>
                      <div>
                        <dt>What would change the thesis</dt>
                        <dd>Watch for slower capacity expansion or signs that customers are switching to custom chips.</dd>
                      </div>
                    </dl>
                  </div>
                )}
                <ResearchNote
                  key={activeSymbol}
                  note={Object.hasOwn(watchlist.notes, activeSymbol) ? watchlist.notes[activeSymbol] : ''}
                  onSave={(note) =>
                    updateWatchlist({
                      ...watchlist,
                      notes: { ...watchlist.notes, [activeSymbol]: note },
                    })
                  }
                />
              </>
            ) : (
              <p className="empty-research">Add a ticker to start a research note.</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
