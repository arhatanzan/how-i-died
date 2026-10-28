import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth';

export default function LoginModal({ onClose }) {
  const { login, configured } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const first = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    first.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      onClose();
    } catch (err) {
      setError(err.status === 401 ? 'Wrong username or password.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="login-backdrop animate-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <form onSubmit={submit} className="login-panel animate-in text-left">
        <button type="button" className="login-close" onClick={onClose} aria-label="Close sign in">×</button>
        <p className="login-eyebrow">A PERSONAL JOURNAL · ARHAT</p>
        <h2 id="login-title" className="font-display text-3xl font-normal tracking-tight text-ink">Come on in.</h2>
        <p className="mt-2 max-w-xs font-note text-sm leading-6 text-muted">Sign in to write and tend the pages of this journal.</p>
        <div className="mt-7 space-y-4">
          {!configured && (
            <p className="editor-error" role="alert">
              Sign-in credentials have not been configured for this deployment.
            </p>
          )}
          <label className="block">
            <span className="label">Username</span>
            <input ref={first} className="field" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        </div>
        {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn justify-center" onClick={onClose}>Return to the journal</button>
          <button type="submit" className="btn-primary justify-center" disabled={busy || !configured}>
            {busy ? 'Opening the journal…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
