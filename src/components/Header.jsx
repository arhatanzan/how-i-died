import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import LoginModal from './LoginModal';

export default function Header({ isJournal }) {
  const { authenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0f0f0f' : '#ffffff';
    localStorage.setItem('theme', theme);
  }, [theme]);

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleTheme() {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }

  return (
    <header className="site-header">
      <nav aria-label="Main navigation">
        <a href="/" aria-current={!isJournal ? 'page' : undefined}>Arhat Anzan</a>
        <a href="/journal" aria-current={isJournal ? 'page' : undefined}>The journal</a>
        <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        {authenticated ? (
          <button type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
        ) : (
          <button type="button" onClick={() => setOpen(true)}>Keeper's door</button>
        )}
      </nav>
      {error && <p className="text-center text-sm text-danger" role="alert">{error}</p>}
      {open && <LoginModal onClose={() => setOpen(false)} />}
    </header>
  );
}
