import { ArrowRight, Bookmark, BookOpen, Layers3 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { errorMessage, request } from './api';
import type { Session, User } from './api';

export function AuthPage({ mode, onSuccess }: { mode: 'sign-in' | 'sign-up'; onSuccess: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'sign-up';
  const action = signingUp ? 'Create account' : 'Sign in';
  const progress = signingUp ? 'Creating account…' : 'Signing in…';
  const missingAccount = signingUp ? 'Could not create your account. Try again.' : 'Could not sign in. Check your username and password.';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await request<Session>(signingUp ? 'register/' : 'session/', {
        method: 'POST',
        body: { username, password },
      });
      if (session.user) onSuccess(session.user);
      else setError(missingAccount);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="welcome">
      <section className="welcome-copy" aria-labelledby="welcome-title">
        <h2 id="welcome-title">Keep your investment thesis in view.</h2>
        <p>Follow companies, save the evidence behind each thesis, and revisit what changed.</p>
        <ul className="welcome-features">
          <li><Bookmark size={17} aria-hidden="true" /> Custom watchlists</li>
          <li><BookOpen size={17} aria-hidden="true" /> Cited research</li>
          <li><Layers3 size={17} aria-hidden="true" /> Thesis history</li>
        </ul>
      </section>
      <section className="signin-card panel" aria-labelledby="signin-title">
        <h1 id="signin-title">{signingUp ? 'Create your account' : 'Sign in'}</h1>
        <form className="signin-form" onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            maxLength={150}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={signingUp ? 8 : undefined}
            aria-describedby={signingUp ? 'password-help' : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {signingUp && <p id="password-help" className="password-help">Use at least 8 characters.</p>}
          {error && <p className="notice notice-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? progress : action} <ArrowRight size={17} aria-hidden="true" />
          </button>
        </form>
        <p className="auth-switch">
          {signingUp ? <>Already registered? <a href="/sign-in/">Sign in</a></> : <>New to DataTalk? <a href="/sign-up/">Sign up</a></>}
        </p>
      </section>
    </main>
  );
}
