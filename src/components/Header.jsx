import { useEffect, useRef, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import LoginModal from './LoginModal';

export default function Header({ isJournal }) {
  const { authenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const navigation = useRef(null);
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

  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      } else if (event.type === 'pointerdown' && !navigation.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [menuOpen]);

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
      <nav ref={navigation} aria-label="Main navigation">
        <a href="/" aria-current={!isJournal ? 'page' : undefined}>Arhat Anzan</a>
        <button ref={menuButton} className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="navigation-links" onClick={() => setMenuOpen((current) => !current)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div id="navigation-links" className="navigation-links" data-open={menuOpen} onClick={() => setMenuOpen(false)}>
          <a href="/journal" aria-current={isJournal ? 'page' : undefined}>The journal</a>
          <button type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
          {authenticated ? (
            <button type="button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button>
          ) : (
            <button type="button" onClick={() => setOpen(true)}>Keeper's door</button>
          )}
        </div>
      </nav>
      {error && <p className="text-center text-sm text-danger" role="alert">{error}</p>}
      {open && <LoginModal onClose={() => setOpen(false)} />}
    </header>
  );
}
