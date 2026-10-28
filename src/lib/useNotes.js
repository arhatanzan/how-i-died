import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

export function useNotes() {
  const { authenticated, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [requestId, setRequestId] = useState(0);
  const [freshIds, setFreshIds] = useState(() => new Set());

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    setNotes([]);
    setLoadedFor(authenticated);
    setStatus('loading');
    setError('');
    api.listNotes()
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The archive returned an invalid response.');
        if (!alive) return;
        setNotes(data);
        setStatus('ready');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message);
        setStatus('error');
      });
    return () => { alive = false; };
  }, [authenticated, authLoading, requestId]);

  const retry = useCallback(() => setRequestId((id) => id + 1), []);
  const add = useCallback((note) => {
    setFreshIds((ids) => new Set(ids).add(note.id));
    setNotes((list) => [note, ...list]);
  }, []);
  const update = useCallback(async (id, patch) => {
    const saved = await api.updateNote(id, patch);
    setNotes((list) => list.map((note) => note.id === id ? saved : note));
    return saved;
  }, []);
  const remove = useCallback(async (id) => {
    await api.deleteNote(id);
    setNotes((list) => list.filter((note) => note.id !== id));
  }, []);

  const sessionChanged = loadedFor !== authenticated;
  return { notes: sessionChanged ? [] : notes, status: authLoading || sessionChanged ? 'loading' : status, error, retry, freshIds, add, update, remove };
}
