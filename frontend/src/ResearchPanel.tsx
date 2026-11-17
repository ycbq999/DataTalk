import { ArrowUpRight, BookOpen, Check, CircleAlert, Clock3, FileText, LoaderCircle, NotebookPen, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { displayDate, errorMessage, isActiveRun, request } from './api';
import type { Research, Run, Security, Thesis } from './api';

function ResearchNote({ securityId }: { securityId: number }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const path = `securities/${securityId}/note/`;

  useEffect(() => {
    const controller = new AbortController();
    request<{ text: string }>(path, { signal: controller.signal })
      .then(({ text }) => {
        if (!controller.signal.aborted) {
          setSaved(text);
          setDraft(text);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [path, attempt]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const { text } = await request<{ text: string }>(path, { method: 'PUT', body: { text: draft } });
      setSaved(text);
      setDraft(text);
      setStatus('Note saved.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="note-panel panel" aria-labelledby="note-title">
      <div className="panel-header">
        <h2 id="note-title"><NotebookPen size={17} aria-hidden="true" /> Your note</h2>
      </div>
      <div className="note-content">
        {error && <p className="notice notice-error" role="alert">{error}</p>}
        {saved === null ? (
          error
            ? <button className="button button-secondary" type="button" onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}>Try again</button>
            : <p role="status" className="muted">Loading note…</p>
        ) : (
          <form className="note-form" onSubmit={save}>
            <label className="sr-only" htmlFor="research-note">Your note</label>
            <textarea
              id="research-note"
              placeholder="What are you watching, and what would change your view?"
              rows={4}
              value={draft}
              maxLength={2000}
              disabled={busy}
              onChange={(event) => {
                setDraft(event.target.value);
                setStatus('');
              }}
            />
            <div className="note-actions">
              <p className="muted" role="status">{status || (draft !== saved ? 'Unsaved changes' : '')}</p>
              <button className="button button-secondary" type="submit" disabled={busy || draft === saved}>
                {busy ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function usableLink(url: string) {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function ThesisReport({ thesis }: { thesis: Thesis }) {
  const { report } = thesis;
  const lists = [
    { title: 'Assumptions', items: report.assumptions },
    { title: 'Catalysts', items: report.catalysts },
    { title: 'Risks', items: report.risks },
    { title: 'What would invalidate it', items: report.invalidation_conditions },
  ];

  return (
    <article className="thesis-report" aria-label={`Thesis version ${thesis.version}`}>
      <div className="thesis-meta">
        <span className="soft-pill">Version {thesis.version}</span>
        <span>Researched {displayDate(thesis.created_at)}</span>
        {report.investment_horizon && <span>Horizon: {report.investment_horizon}</span>}
      </div>
      <p className="thesis-summary">{report.summary}</p>
      <div className="case-grid">
        <section className="case case-bull"><h3>Bull case</h3><p>{report.bull_case}</p></section>
        <section className="case case-bear"><h3>Bear case</h3><p>{report.bear_case}</p></section>
      </div>
      <div className="evidence-grid">
        {lists.filter(({ items }) => items.length > 0).map(({ title, items }) => (
          <section key={title}>
            <h3>{title}</h3>
            <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </section>
        ))}
      </div>
      {report.uncertainty && <div className="notice notice-neutral"><strong>Uncertainty</strong><p>{report.uncertainty}</p></div>}
      {thesis.sources.length > 0 && (
        <section className="source-section">
          <h3>Sources</h3>
          <ul className="source-list">
            {thesis.sources.map((source, index) => (
              <li key={index}>
                {usableLink(source.url) ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title} <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                ) : <strong>{source.title}</strong>}
                {source.published_at && <p className="source-date">{displayDate(source.published_at)}</p>}
                {source.claims && source.claims.length > 0 && (
                  <ul className="source-claims">{source.claims.map((claim, index) => <li key={index}>{claim}</li>)}</ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {thesis.model && <p className="model-label">Model: {thesis.model}</p>}
    </article>
  );
}

function RunStatus({ run }: { run: Run }) {
  if (run.status === 'failed') {
    return <p className="notice notice-error" role="alert"><CircleAlert size={16} aria-hidden="true" />
      {run.error || 'The research job failed. You can start another run.'}</p>;
  }
  if (run.status === 'succeeded') {
    return <p className="notice notice-success" role="status"><Check size={16} aria-hidden="true" /> Research complete.</p>;
  }
  return (
    <p className="notice notice-neutral" role="status">
      {run.status === 'queued' ? <Clock3 size={16} aria-hidden="true" /> : <LoaderCircle className="spinner" size={16} aria-hidden="true" />}
      {run.status === 'queued' ? 'Research queued.' : 'Research in progress. You can return to this security later.'}
    </p>
  );
}

export function ResearchPanel({ security }: { security: Security }) {
  const [research, setResearch] = useState<Research | null>(null);
  const [startError, setStartError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [pollError, setPollError] = useState('');
  const [starting, setStarting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [thesisId, setThesisId] = useState<number | null>(null);
  const latestRun = research?.runs[0];
  const running = isActiveRun(latestRun);
  const latestThesis = research?.theses[0];
  const visibleThesis = research?.theses.find((thesis) => thesis.id === thesisId) ?? latestThesis;
  const path = `securities/${security.id}/research/`;

  useEffect(() => {
    const controller = new AbortController();
    request<Research>(path, { signal: controller.signal })
      .then((snapshot) => {
        if (!controller.signal.aborted) setResearch(snapshot);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      });
    return () => controller.abort();
  }, [path, attempt]);

  useEffect(() => {
    if (!running) return;
    const controller = new AbortController();
    let timer: number | undefined;

    async function poll() {
      try {
        const snapshot = await request<Research>(path, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setResearch(snapshot);
        setPollError('');
        if (!isActiveRun(snapshot.runs[0])) return;
      } catch {
        if (controller.signal.aborted) return;
        setPollError('Could not refresh progress. Retrying…');
      }
      timer = window.setTimeout(poll, 2500);
    }

    timer = window.setTimeout(poll, 1500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [path, running]);

  async function start() {
    setStarting(true);
    setStartError('');
    try {
      const run = await request<Run>(path, { method: 'POST' });
      setResearch((snapshot) => snapshot && {
        ...snapshot,
        runs: [run, ...snapshot.runs.filter((item) => item.id !== run.id)],
      });
      setThesisId(null);
    } catch (error) {
      setStartError(errorMessage(error));
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="research-column">
      <section className="security-header panel" aria-labelledby="security-title">
        <span className="security-mark security-mark-large" aria-hidden="true">{security.symbol.slice(0, 1)}</span>
        <div className="security-title">
          <div className="security-heading">
            <h2 id="security-title">{security.symbol}</h2>
            <span className="soft-pill exchange">{security.exchange}</span>
          </div>
          <p>{security.name}</p>
        </div>
        {research?.enabled && (
          <button className="button button-primary" type="button" disabled={running || starting} onClick={start}>
            <Sparkles size={17} aria-hidden="true" />
            {starting ? 'Starting…' : running ? 'Research running' : latestRun?.status === 'failed' ? 'Retry research' : latestThesis ? 'Run again' : 'Run research'}
          </button>
        )}
      </section>
      <section className="thesis-panel panel" aria-labelledby="thesis-title">
        <div className="panel-header">
          <h2 id="thesis-title"><BookOpen size={17} aria-hidden="true" /> Investment thesis</h2>
          {research && research.theses.length > 1 && (
            <select className="version-select" aria-label="Thesis version" value={thesisId ?? ''}
              onChange={(event) => setThesisId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Latest (v{latestThesis?.version})</option>
              {research.theses.slice(1).map((thesis) => (
                <option key={thesis.id} value={thesis.id}>v{thesis.version} · {displayDate(thesis.created_at)}</option>
              ))}
            </select>
          )}
        </div>
        <div className="thesis-content">
          {loadError ? (
            <>
              <p className="notice notice-error" role="alert">{loadError}</p>
              <button className="button button-secondary" type="button" onClick={() => {
                setLoadError('');
                setAttempt((value) => value + 1);
              }}>Try again</button>
            </>
          ) : !research ? (
            <p className="muted" role="status">Loading research…</p>
          ) : (
            <>
              {startError && <p className="notice notice-error" role="alert">{startError}</p>}
              {latestRun && <RunStatus run={latestRun} />}
              {pollError && <p className="notice notice-neutral" role="status">{pollError}</p>}
              {visibleThesis
                ? <ThesisReport thesis={visibleThesis} />
                : <div className="thesis-empty">
                  <FileText size={22} aria-hidden="true" />
                  <h3>No thesis yet</h3>
                  <p>{running
                    ? 'Your report will appear here when the run completes.'
                    : research.enabled
                      ? 'Run research to create a report with assumptions, risks, and sources.'
                      : 'AI research is unavailable in this environment.'}</p>
                </div>}
            </>
          )}
        </div>
      </section>
      <ResearchNote securityId={security.id} />
    </div>
  );
}
