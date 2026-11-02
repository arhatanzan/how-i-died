import { useCallback, useState } from 'react';

/**
 * Custom hook for managing async operations with loading, error, and data states
 * Reduces boilerplate for common async patterns
 */
export function useAsync(initialData = null, initialError = '') {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  const execute = useCallback(async (asyncFn) => {
    setLoading(true);
    setError('');
    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setError(initialError);
    setLoading(false);
  }, [initialData, initialError]);

  const setErrorMessage = useCallback((msg) => setError(msg), []);

  return { data, loading, error, execute, reset, setError: setErrorMessage, setData };
}
