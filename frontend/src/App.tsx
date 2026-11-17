import { BookOpen, CircleAlert, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AuthPage } from './AuthPage';
import { errorMessage, request } from './api';
import type { Session, User } from './api';
import { MarketHome } from './MarketHome';
import { Workspace } from './Workspace';

function currentRoute() {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [failure, setFailure] = useState('');
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const route = currentRoute();
  const isHome = route === '/';
  const isWorkspace = route === '/workspace';
  const isAuth = route === '/sign-in' || route === '/sign-up';

  useEffect(() => {
    const controller = new AbortController();
    request<Session>('session/', { signal: controller.signal })
      .then((session) => {
        if (!controller.signal.aborted) setUser(session.user);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setFailure(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt]);

  const redirect = isWorkspace && user === null ? '/sign-in/' : isAuth && user ? '/workspace/' : null;
  useEffect(() => {
    if (redirect) window.location.replace(redirect);
  }, [redirect]);

  async function signOut() {
    setSignOutError('');
    setSigningOut(true);
    try {
      await request('session/', { method: 'DELETE' });
      if (isHome) setUser(null);
      else window.location.replace('/');
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
          <div className="site-nav">
            <a className="wordmark" href="/" aria-label="ThesisWatch home">
              <span className="wordmark-icon"><BookOpen size={19} strokeWidth={2.3} aria-hidden="true" /></span>
              <span>Thesis<span className="wordmark-accent">Watch</span></span>
            </a>
            <a className="header-explore" href="/" aria-current={isHome ? 'page' : undefined}>Explore stocks</a>
          </div>
          {(user !== undefined || failure) && (
            <nav className="account" aria-label="Account">
              {user ? (
                <>
                  <a className="button button-header-link" href="/workspace/" aria-current={isWorkspace ? 'page' : undefined}>
                    My workspace
                  </a>
                  <button className="button button-account" type="button" onClick={signOut} disabled={signingOut}>
                    <LogOut size={16} aria-hidden="true" /> {signingOut ? 'Signing out…' : 'Sign out'}
                  </button>
                </>
              ) : (
                <>
                  <a className="button button-header-link" href="/sign-in/" aria-current={route === '/sign-in' ? 'page' : undefined}>Sign in</a>
                  <a className="button button-header-accent" href="/sign-up/" aria-current={route === '/sign-up' ? 'page' : undefined}>Sign up</a>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
      {signOutError && <p className="page-notice notice notice-error" role="alert">{signOutError}</p>}
      {isHome ? (
        <MarketHome signedIn={Boolean(user)} />
      ) : isWorkspace || isAuth ? (
        failure ? (
          <main id="main" className="connection-view panel">
            <CircleAlert size={23} aria-hidden="true" />
            <h1>Could not open your account</h1>
            <p role="alert">{failure}</p>
            <button className="button button-primary" type="button" onClick={() => {
              setFailure('');
              setAttempt((value) => value + 1);
            }}>Try again</button>
          </main>
        ) : redirect || user === undefined ? (
          <main id="main" className="connection-view panel"><p role="status">Opening ThesisWatch…</p></main>
        ) : isWorkspace && user ? (
          <Workspace key={user.id} />
        ) : (
          <AuthPage mode={route === '/sign-up' ? 'sign-up' : 'sign-in'} onSuccess={setUser} />
        )
      ) : (
        <main id="main" className="connection-view panel">
          <h1>Page unavailable</h1>
          <p><a href="/">Back to the stock explorer</a></p>
        </main>
      )}
    </>
  );
}
