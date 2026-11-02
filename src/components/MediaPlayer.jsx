import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

export default function MediaPlayer({ type, src, label, onError }) {
  const media = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const Element = type === 'audio' ? 'audio' : 'video';

  async function togglePlayback() {
    const element = media.current;
    setError('');
    try {
      if (element.paused) await element.play();
      else element.pause();
    } catch (cause) {
      if (cause.name !== 'AbortError' || (!element.paused && element.isConnected)) {
        setError(`Could not play ${type}: ${cause.message}`);
      }
    }
  }

  return (
    <div className="media-player">
      <Element
        ref={media}
        controls
        {...(type === 'video' ? { playsInline: true } : {})}
        preload="metadata"
        src={src}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onEmptied={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          if (onError) onError();
          else setError(`This browser cannot play this ${type} format. Try downloading it to play in another app.`);
        }}
      />
      <button type="button" className="btn-outline media-playback-toggle" aria-label={`${playing ? 'Pause' : 'Play'} ${type}: ${label}`} onClick={togglePlayback}>
        {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        {playing ? 'Pause' : 'Play'} {type}
      </button>
      {error && <p className="editor-error" role="alert">{error}</p>}
    </div>
  );
}
