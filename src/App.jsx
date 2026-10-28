import { useEffect } from 'react';
import Header from './components/Header';
import Journal from './pages/Journal';
import Home from './pages/Home';
import { useAuth } from './lib/auth';
import { useNotes } from './lib/useNotes';

export default function App() {
  const isJournal = window.location.pathname.replace(/\/+$/, '') === '/journal';
  const { authenticated } = useAuth();
  const { notes, status, error, retry, freshIds, add, update, remove } = useNotes();

  useEffect(() => {
    document.title = isJournal ? 'The Journal · Arhat Anzan' : 'Arhat Anzan · How I Died';
  }, [isJournal]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header isJournal={isJournal} />
      <main className="flex-1">
        {isJournal ? (
          <Journal
            notes={notes}
            status={status}
            error={error}
            retry={retry}
            freshIds={freshIds}
            onAdd={add}
            onUpdate={update}
            onDelete={remove}
            authenticated={authenticated}
          />
        ) : (
          <Home
            notes={notes}
            status={status}
            error={error}
            retry={retry}
            isAdmin={authenticated}
            onUpdate={update}
            onDelete={remove}
            freshIds={freshIds}
          />
        )}
      </main>
      <footer className="site-footer mt-8 border-t px-5 py-8 text-center text-xs font-medium tracking-[0.12em] uppercase">
        A small record of a life in progress · How I Died
      </footer>
    </div>
  );
}
