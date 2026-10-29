import { useEffect, useState } from 'react';
import { mediaId } from '../../shared/media';
import { fetchMedia } from './media';

export function useMediaUrl(attachment, enabled = true) {
  const [state, setState] = useState({ url: '', progress: 0, error: '' });
  const [attempt, setAttempt] = useState(0);
  const { url, name } = attachment;
  useEffect(() => {
    if (!mediaId(url)) { setState({ url, progress: 100, error: '' }); return; }
    if (!enabled) return;
    const controller = new AbortController();
    let objectUrl;
    setState({ url: '', progress: 0, error: '' });
    fetchMedia({ url, name }, {
      signal: controller.signal,
      onProgress: (progress) => { if (!controller.signal.aborted) setState({ url: '', progress, error: '' }); },
    }).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ url: objectUrl, progress: 100, error: '' });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ url: '', progress: 0, error: error.message });
    });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, name, enabled, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
