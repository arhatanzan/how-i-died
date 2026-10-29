import { useEffect, useRef, useState } from 'react';
import { MAX_FILE_BYTES, MAX_RECORDING_SECONDS } from '../../shared/media.js';

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function MediaCapture({ mode, onAdd, onClose }) {
  const dialog = useRef(null);
  const preview = useRef(null);
  const stream = useRef(null);
  const recorder = useRef(null);
  const active = useRef(true);
  const [status, setStatus] = useState('requesting');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState(null);
  const [resultUrl, setResultUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    async function connect() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live capture requires HTTPS (or localhost) and a browser with camera/microphone support. You can still upload a file.');
        if (mode !== 'photo' && !window.MediaRecorder) throw new Error('Recording is not supported in this browser. You can still upload an audio or video file.');
        const media = await navigator.mediaDevices.getUserMedia({
          video: mode === 'audio' ? false : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: mode !== 'photo',
        });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (preview.current) preview.current.srcObject = media;
        setStatus('ready');
      } catch (cause) {
        if (cancelled) return;
        setError(cause.name === 'NotAllowedError' ? 'Camera or microphone permission was denied. Allow access in your browser settings, or upload a file instead.' : cause.message);
        setStatus('error');
      }
    }
    connect();
    return () => {
      cancelled = true;
      active.current = false;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      element.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [mode]);

  useEffect(() => {
    if (!result) return;
    const url = URL.createObjectURL(result);
    setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  useEffect(() => {
    if (status !== 'recording') return;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS && recorder.current?.state === 'recording') recorder.current.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  function finish(blob, extension) {
    stream.current?.getTracks().forEach((track) => track.stop());
    if (!active.current) return;
    if (!blob.size || blob.size > MAX_FILE_BYTES) {
      setError('The recording is empty or exceeds 250 MB. Close this window and try a shorter recording.');
      setStatus('error');
      return;
    }
    setResult(new File([blob], `capture-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`, { type: blob.type }));
    setStatus('review');
  }

  async function takePhoto() {
    try {
      const video = preview.current;
      if (!video.videoWidth || !video.videoHeight) throw new Error('The camera is still warming up. Try again in a moment.');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser could not capture a photo.');
      context.drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('The photo could not be captured.');
      finish(blob, 'jpg');
    } catch (cause) { setError(cause.message); }
  }

  function startRecording() {
    setError('');
    try {
      const candidates = mode === 'audio'
        ? ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus']
        : ['video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc3.42001e,mp4a.40.2', 'video/mp4', 'video/webm'];
      const playable = document.createElement(mode === 'audio' ? 'audio' : 'video');
      const supported = candidates.filter((candidate) => MediaRecorder.isTypeSupported(candidate));
      const mimeType = supported.find((candidate) => playable.canPlayType(candidate) === 'probably') || supported[0];
      const recording = new MediaRecorder(stream.current, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
        ...(mode === 'video' ? { videoBitsPerSecond: 1500000 } : {}),
      });
      recorder.current = recording;
      const chunks = [];
      let bytes = 0;
      let failed = false;
      recording.ondataavailable = ({ data }) => {
        if (!data.size) return;
        chunks.push(data);
        bytes += data.size;
        if (bytes >= MAX_FILE_BYTES - 2 * 1024 * 1024 && recording.state === 'recording') recording.stop();
      };
      recording.onerror = (event) => {
        failed = true;
        stream.current?.getTracks().forEach((track) => track.stop());
        if (active.current) {
          setStatus('error');
          setError(event.error?.message || 'Recording failed. Close this window and try again.');
        }
      };
      recording.onstop = () => {
        if (failed || !active.current) return;
        const type = recording.mimeType.split(';')[0];
        const extension = type.includes('mp4') ? (mode === 'audio' ? 'm4a' : 'mp4') : type.includes('ogg') ? 'ogg' : 'webm';
        finish(new Blob(chunks, { type }), extension);
      };
      recording.start(1000);
      setSeconds(0);
      setStatus('recording');
    } catch (cause) { setError(`Could not start recording: ${cause.message}`); }
  }

  return (
    <dialog ref={dialog} className="capture-dialog" aria-label={mode === 'photo' ? 'Take a photo' : `Record ${mode}`} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <h2>{mode === 'photo' ? 'A live photo' : `Record ${mode}`}</h2>
      {mode !== 'audio' && status !== 'review' && <video ref={preview} autoPlay muted playsInline aria-label="Live camera preview" />}
      {status === 'requesting' && <p role="status">Waiting for permission…</p>}
      {status === 'recording' && <p role="status">Recording · {clock(seconds)} / {clock(MAX_RECORDING_SECONDS)}</p>}
      {status === 'review' && resultUrl && (
        mode === 'photo' ? <img src={resultUrl} alt="Captured photo preview" />
          : mode === 'audio' ? <audio controls src={resultUrl} aria-label="Recorded audio preview" onError={() => setError('This browser cannot preview the recorded audio. You can still add it and download it for playback in another app.')} />
            : <video controls playsInline src={resultUrl} aria-label="Recorded video preview" onError={() => setError('This browser cannot preview the recorded video. You can still add it and download it for playback in another app.')} />
      )}
      <p className="editor-hint">Only starts with your permission. Recordings stop at 10 minutes or the file size limit. Review before adding to your note.</p>
      {error && <p className="editor-error" role="alert">{error}</p>}
      <div className="capture-actions">
        <button type="button" className="text-button" onClick={onClose}>{status === 'review' ? 'Discard' : 'Cancel'}</button>
        {status === 'ready' && <button type="button" className="btn-primary" onClick={mode === 'photo' ? takePhoto : startRecording}>{mode === 'photo' ? 'Take photo' : 'Start recording'}</button>}
        {status === 'recording' && <button type="button" className="btn-primary" onClick={() => recorder.current.stop()}>Stop recording</button>}
        {status === 'review' && <button type="button" className="btn-primary" onClick={() => { onAdd([result]); onClose(); }}>Use {mode === 'photo' ? 'photo' : 'recording'}</button>}
      </div>
    </dialog>
  );
}
