import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

export function useNotes() {
  const { authenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState({
    notes: [],
    status: 'loading',
    error: '',
    freshIds: new Set(),
    loadedFor: null,
    requestId: 0,
  });

  useEffect(() => {
    if (authLoading) return;

    let alive = true;
    setState((prev) => ({
      ...prev,
      notes: [],
      loadedFor: authenticated,
      status: 'loading',
      error: '',
    }));

    api.listNotes()
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The archive returned an invalid response.');
        if (!alive) return;
        setState((prev) => ({ ...prev, notes: data, status: 'ready' }));
      })
      .catch((err) => {
        if (!alive) return;
        setState((prev) => ({ ...prev, error: err.message, status: 'error' }));
      });

    return () => { alive = false; };
  }, [authenticated, authLoading, state.requestId]);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, requestId: prev.requestId + 1 }));
  }, []);

  const add = useCallback((note) => {
    setState((prev) => ({
      ...prev,
      freshIds: new Set(prev.freshIds).add(note.id),
      notes: [note, ...prev.notes],
    }));
  }, []);

  const update = useCallback(async (id, patch) => {
    const saved = await api.updateNote(id, patch);
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((note) => (note.id === id ? saved : note)),
    }));
    return saved;
  }, []);

  const remove = useCallback(async (id) => {
    await api.deleteNote(id);
    setState((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== id),
    }));
  }, []);

  const sessionChanged = state.loadedFor !== authenticated;
  return {
    notes: sessionChanged ? [] : state.notes,
    status: authLoading || sessionChanged ? 'loading' : state.status,
    error: state.error,
    retry,
    freshIds: state.freshIds,
    add,
    update,
    remove,
  };
}
