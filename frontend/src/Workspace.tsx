import { ArrowRight, Bookmark, ChevronDown, CirclePlus, List, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage, request } from './api';
import type { Entry, Security, Watchlist } from './api';
import { ResearchPanel } from './ResearchPanel';

function ListEditor({
  initialName,
  title,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  title: string;
  busy: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  }

  return (
    <form className="list-editor" onSubmit={submit}>
      <label htmlFor="watchlist-name">{title}</label>
      <input
        id="watchlist-name"
        name="watchlist-name"
        placeholder="e.g. Core holdings"
        maxLength={80}
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <div className="form-actions">
        <button className="button button-primary" type="submit" disabled={busy || !name.trim()}>Save</button>
        <button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function AddSecurity({
  entries,
  busy,
  onAdd,
  onCancel,
}: {
  entries: Entry[];
  busy: boolean;
  onAdd: (security: Security) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<{ query: string; matches: Security[]; error: string } | null>(null);
  const term = query.trim();

  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const matches = await request<Security[]>(`securities/?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setSearch({ query: term, matches, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setSearch({ query: term, matches: [], error: errorMessage(error) });
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const result = search?.query === term ? search : null;

  return (
    <div className="security-search">
      <label htmlFor="security-search">Find a security</label>
      <div className="input-icon-wrap">
        <Search size={16} aria-hidden="true" />
        <input
          id="security-search"
          type="search"
          placeholder="Ticker or company name"
          autoComplete="off"
          autoFocus
          maxLength={100}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {term && (
        <div className="search-results">
          {!result
            ? <p role="status">Searching…</p>
            : result.error
              ? <p className="notice notice-error" role="alert">{result.error}</p>
              : result.matches.length === 0
                ? <p role="status">No matching securities.</p>
                : (
                  <ul aria-label="Search results">
                    {result.matches.map((security) => {
                      const tracked = entries.some((entry) => entry.security.id === security.id);
                      return (
                        <li key={security.id}>
                          <button
                            type="button"
                            className="search-hit"
                            disabled={busy || tracked}
                            onClick={async () => {
                              if (await onAdd(security)) onCancel();
                            }}
                          >
                            <span>
                              <strong>{security.symbol}</strong> <small>{security.exchange}</small>
                              <span>{security.name}</span>
                            </span>
                            {tracked
                              ? <small>Added</small>
                              : <Plus size={16} aria-label="Add" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
        </div>
      )}
      <button className="button button-secondary" type="button" onClick={onCancel} disabled={busy}>Close search</button>
    </div>
  );
}

export function Workspace() {
  const [watchlists, setWatchlists] = useState<Watchlist[] | null>(null);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
  const [mode, setMode] = useState<'new' | 'rename' | 'delete' | 'add' | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const selectedList = watchlists?.find((list) => list.id === activeListId) ?? watchlists?.[0];
  const entries = selectedList?.entries ?? [];
  const activeEntry = entries.find((entry) => entry.id === activeEntryId) ?? entries[0];

  useEffect(() => {
    const controller = new AbortController();
    request<Watchlist[]>('watchlists/', { signal: controller.signal })
      .then((lists) => setWatchlists(lists))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt]);

  function selectList(id: number) {
    setActiveListId(id);
    setActiveEntryId(null);
    setActionError('');
    setMode(null);
  }

  function selectMode(next: typeof mode) {
    setMode(next);
    setActionError('');
  }

  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setActionError('');
    try {
      await action();
      return true;
    } catch (error) {
      setActionError(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createList(name: string) {
    await mutate(async () => {
      const created = await request<Watchlist>('watchlists/', { method: 'POST', body: { name } });
      setWatchlists((lists) => [...(lists ?? []), created]);
      selectList(created.id);
    });
  }

  async function renameList(list: Watchlist, name: string) {
    await mutate(async () => {
      const renamed = await request<Watchlist>(`watchlists/${list.id}/`, { method: 'PATCH', body: { name } });
      setWatchlists((lists) => lists?.map((item) => item.id === renamed.id ? { ...item, name: renamed.name } : item) ?? null);
      setMode(null);
    });
  }

  async function deleteList(list: Watchlist) {
    await mutate(async () => {
      await request(`watchlists/${list.id}/`, { method: 'DELETE' });
      setWatchlists((lists) => lists?.filter((item) => item.id !== list.id) ?? null);
      setActiveListId(null);
      setActiveEntryId(null);
      setMode(null);
    });
  }

  function addEntry(list: Watchlist, security: Security) {
    return mutate(async () => {
      const added = await request<Entry>(`watchlists/${list.id}/entries/`, {
        method: 'POST',
        body: { security_id: security.id },
      });
      setWatchlists((lists) => lists?.map((item) => item.id === list.id
        ? { ...item, entries: [...item.entries, added] } : item) ?? null);
      setActiveEntryId(added.id);
    });
  }

  async function removeEntry(list: Watchlist, entry: Entry) {
    await mutate(async () => {
      await request(`watchlists/${list.id}/entries/${entry.id}/`, { method: 'DELETE' });
      setWatchlists((lists) => lists?.map((item) => item.id === list.id
        ? { ...item, entries: item.entries.filter((tracked) => tracked.id !== entry.id) } : item) ?? null);
    });
  }

  return (
    <main id="main" className="workspace">
      <div className="workspace-heading">
        <h1>Research dashboard</h1>
      </div>
      <div className="workspace-grid">
        <section className="watchlist-panel panel" aria-labelledby="watchlists-title">
          <div className="panel-header">
            <h2 id="watchlists-title"><Bookmark size={17} aria-hidden="true" /> Watchlists</h2>
            <button className="button button-icon" type="button" title="New watchlist" aria-label="Create a watchlist"
              onClick={() => selectMode('new')} disabled={busy || !watchlists}>
              <Plus size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="watchlist-content">
            {loadError ? (
              <>
                <p className="notice notice-error" role="alert">{loadError}</p>
                <button className="button button-secondary" type="button" onClick={() => {
                  setLoadError('');
                  setAttempt((value) => value + 1);
                }}>Try again</button>
              </>
            ) : watchlists === null ? (
              <p className="list-empty" role="status">Loading watchlists…</p>
            ) : (
              <>
                {selectedList && (
                  <div className="list-toolbar">
                    <div className="select-wrap">
                      <List size={17} aria-hidden="true" />
                      <select
                        aria-label="Current watchlist"
                        value={selectedList.id}
                        onChange={(event) => selectList(Number(event.target.value))}
                        disabled={busy}
                      >
                        {watchlists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}
                      </select>
                      <ChevronDown size={15} aria-hidden="true" />
                    </div>
                    <button className="button button-icon" type="button" title="Rename watchlist" aria-label="Rename watchlist"
                      onClick={() => selectMode('rename')} disabled={busy}>
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button className="button button-icon" type="button" title="Delete watchlist" aria-label="Delete watchlist"
                      onClick={() => selectMode('delete')} disabled={busy}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {mode === 'new' && <ListEditor key="new" initialName="" title="New watchlist name"
                  busy={busy} onSave={createList} onCancel={() => selectMode(null)} />}
                {mode === 'rename' && selectedList && <ListEditor key={selectedList.id} initialName={selectedList.name}
                  title="Watchlist name" busy={busy} onSave={(name) => renameList(selectedList, name)}
                  onCancel={() => selectMode(null)} />}
                {mode === 'delete' && selectedList && (
                  <div className="list-editor">
                    <p>Delete <strong>{selectedList.name}</strong> and remove its entries?</p>
                    <div className="form-actions">
                      <button className="button button-danger" type="button" disabled={busy}
                        onClick={() => deleteList(selectedList)}>Confirm delete</button>
                      <button className="button button-secondary" type="button" disabled={busy}
                        onClick={() => selectMode(null)}>Cancel</button>
                    </div>
                  </div>
                )}
                {actionError && <p className="notice notice-error" role="alert">{actionError}</p>}
                {selectedList ? (
                  <>
                    {entries.length > 0
                      ? <ul className="entry-list" aria-label="Tracked securities">
                        {entries.map((entry) => (
                          <li key={entry.id} className={entry.id === activeEntry?.id ? 'entry-selected' : undefined}>
                            <button type="button" className="entry-button" aria-pressed={entry.id === activeEntry?.id}
                              onClick={() => setActiveEntryId(entry.id)}>
                              <span className="security-mark" aria-hidden="true">{entry.security.symbol.slice(0, 1)}</span>
                              <span className="entry-copy">
                                <strong>{entry.security.symbol}</strong>
                                <small>{entry.security.name}</small>
                              </span>
                            </button>
                            <button className="button button-icon entry-remove" type="button"
                              title={`Remove ${entry.security.symbol}`} aria-label={`Remove ${entry.security.symbol}`}
                              onClick={() => removeEntry(selectedList, entry)} disabled={busy}>
                              <X size={15} aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      : <p className="list-empty">This watchlist is empty.</p>}
                    {mode === 'add'
                      ? <AddSecurity key={selectedList.id} entries={entries} busy={busy}
                        onAdd={(security) => addEntry(selectedList, security)} onCancel={() => selectMode(null)} />
                      : <button className="button button-secondary add-security" type="button" onClick={() => selectMode('add')} disabled={busy}>
                        <CirclePlus size={16} aria-hidden="true" /> Add security
                      </button>}
                  </>
                ) : mode !== 'new' && (
                  <div className="list-empty">
                    <p>Create a watchlist to start following companies.</p>
                    <button className="button button-primary" type="button" onClick={() => selectMode('new')}>
                      New watchlist <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        {activeEntry ? (
          <ResearchPanel key={activeEntry.security.id} security={activeEntry.security} />
        ) : (
          <section className="empty-research panel" aria-labelledby="empty-research-title">
            <span className="empty-research-icon"><Search size={26} aria-hidden="true" /></span>
            <h2 id="empty-research-title">Select a security</h2>
            <p>Open a company from your watchlist to see research, thesis history, and your notes.</p>
          </section>
        )}
      </div>
    </main>
  );
}
