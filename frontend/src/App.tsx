import { ArrowRight, Bookmark, BookOpen, CircleAlert, Layers3, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage, request } from './api';
import type { Session, User } from './api';
import { Workspace } from './Workspace';

function SignIn({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await request<Session>('session/', {
        method: 'POST',
        body: { username, password },
      });
      if (session.user) onSuccess(session.user);
      else setError('Could not sign in. Check your username and password.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="welcome">
      <section className="welcome-copy" aria-labelledby="welcome-title">
        <h1 id="welcome-title">Keep your investment thesis in view.</h1>
        <p>Follow the companies you care about, keep the evidence behind each thesis, and revisit what changed.</p>
        <ul className="welcome-features">
          <li><Bookmark size={17} aria-hidden="true" /> Custom watchlists</li>
          <li><BookOpen size={17} aria-hidden="true" /> Cited research</li>
          <li><Layers3 size={17} aria-hidden="true" /> Thesis history</li>
        </ul>
      </section>

      <section className="signin-card panel" aria-labelledby="signin-title">
        <h2 id="signin-title">Sign in</h2>
        <p>Open your research workspace.</p>
        <form className="signin-form" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [failure, setFailure] = useState('');
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    request<Session>('session/', { signal: controller.signal })
      .then((session) => setUser(session.user))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt]);

  async function signOut() {
    setSignOutError('');
    setSigningOut(true);
    try {
      await request('session/', { method: 'DELETE' });
      setUser(null);
    } catch (error) {
      setSignOutError(errorMessage(error));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="header-inner">
          <div className="wordmark">
            <span className="wordmark-icon"><BookOpen size={19} strokeWidth={2.3} aria-hidden="true" /></span>
            <span>Thesis<span className="wordmark-accent">Watch</span></span>
          </div>
          {user && (
            <div className="account">
              <span title={user.username} className="account-name">{user.username}</span>
              <button className="button button-account" type="button" onClick={signOut} disabled={signingOut}>
                <LogOut size={16} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </header>
      {signOutError && <p className="page-notice notice notice-error" role="alert">{signOutError}</p>}
      {user === undefined ? (
        <main id="main" className="connection-view panel">
          {failure ? (
            <>
              <CircleAlert size={23} aria-hidden="true" />
              <h1>ThesisWatch is unavailable</h1>
              <p role="alert">{failure}</p>
              <button className="button button-primary" type="button" onClick={() => {
                setFailure('');
                setAttempt((value) => value + 1);
              }}>Try again</button>
            </>
          ) : <p role="status">Opening ThesisWatch…</p>}
        </main>
      ) : user ? <Workspace key={user.id} /> : <SignIn onSuccess={setUser} />}
    </>
  );
}
