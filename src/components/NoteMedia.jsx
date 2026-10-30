import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { getEmbed } from '../../shared/attachments';
import { formatBytes, mediaId } from '../../shared/media';
import { useMediaUrl } from '../lib/useMediaUrl';

function Photo({ image, onOpen }) {
  const [failed, setFailed] = useState(false);
  const source = useMediaUrl(image);
  if (failed || source.error) {
    return (
      <div className="photo-unavailable" role="status">
        <p>This photo couldn’t be loaded.</p>
        {source.error && <p role="alert">{source.error}</p>}
        <button type="button" className="text-button" onClick={() => { setFailed(false); source.retry(); }}>Try again</button>
      </div>
    );
  }
  if (!source.url) return <p role="status">Loading photo · {source.progress}%</p>;
  return (
    <figure className="note-photo">
      <button type="button" onClick={onOpen} aria-label={`Enlarge photo: ${image.alt || 'journal photo'}`}>
        <img src={source.url} alt={image.alt || ''} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </button>
      {image.alt && <figcaption>{image.alt}</figcaption>}
    </figure>
  );
}

function PhotoViewer({ images, initialIndex, onClose }) {
  const dialog = useRef(null);
  const [index, setIndex] = useState(initialIndex);
  const image = images[index];
  const source = useMediaUrl(image);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  const move = (offset) => setIndex((current) => (current + offset + images.length) % images.length);

  return (
    <dialog
      ref={dialog}
      className="photo-viewer"
      aria-label="Journal photo viewer"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'ArrowLeft') move(-1);
        if (event.key === 'ArrowRight') move(1);
      }}
    >
      <button type="button" className="viewer-close" onClick={onClose} aria-label="Close photo">×</button>
      <figure>
        {source.url ? <img key={image.url} src={source.url} alt={image.alt || 'Journal photo'} /> : <p role="status">Loading photo · {source.progress}%</p>}
        {source.error && <p role="alert">{source.error}<button type="button" className="text-button" onClick={source.retry}>Try again</button></p>}
        <figcaption>{image.alt || 'A moment kept.'}</figcaption>
      </figure>
      {images.length > 1 && (
        <div className="viewer-navigation">
          <button type="button" onClick={() => move(-1)} aria-label="Previous photo">←</button>
          <span aria-live="polite">{index + 1} / {images.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next photo">→</button>
        </div>
      )}
    </dialog>
  );
}

function LinkAttachment({ attachment }) {
  const [loaded, setLoaded] = useState(false);
  const embed = getEmbed(attachment.url);
  const hostname = new URL(attachment.url).hostname.replace(/^www\./, '');
  const label = attachment.title || (embed ? `A little ${embed.kind === 'audio' ? 'listening' : 'watching'}` : hostname);

  return (
    <div className={`note-link ${embed ? `note-embed note-embed-${embed.kind}` : ''}`}>
      {embed && (loaded ? (
        <iframe
          src={embed.src}
          title={`${embed.provider}: ${label}`}
          height={embed.provider === 'Spotify' ? 352 : undefined}
          loading="lazy"
          allow="encrypted-media; fullscreen; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="embed-cover" onClick={() => setLoaded(true)}>
          <span className="embed-play" aria-hidden="true">{embed.kind === 'audio' ? '♫' : '▷'}</span>
          <span>Load {embed.provider}</span>
          <small>Connects to {embed.provider} only when you choose.</small>
        </button>
      ))}
      <a className="note-link-caption" href={attachment.url} target="_blank" rel="noopener noreferrer">
        <span><small>{embed?.provider || hostname}</small><strong>{label}</strong></span>
        <span aria-hidden="true">↗</span>
      </a>
      {loaded && <p className="embed-help">Player unavailable? Open the original using the link above.</p>}
    </div>
  );
}

function FileAttachment({ attachment }) {
  const [loaded, setLoaded] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const source = useMediaUrl(attachment, loaded);
  const label = attachment.title || attachment.name;
  const isPlayback = attachment.type === 'audio' || attachment.type === 'video';
  return (
    <figure className={`note-file${isPlayback ? ` note-file-media note-file-${attachment.type}` : ''}`}>
      {!loaded && isPlayback && (
        <button type="button" className="embed-cover media-cover" aria-label={`Load ${attachment.type}: ${label}`} onClick={() => setLoaded(true)}>
          <span className="embed-play" aria-hidden="true"><Play size={22} /></span>
          <span>Load {attachment.type}</span>
        </button>
      )}
      <figcaption><strong>{label}</strong><small>{attachment.name} · {formatBytes(attachment.size)}</small></figcaption>
      {!loaded && !isPlayback && <button type="button" className="btn-outline" onClick={() => setLoaded(true)}>Prepare download</button>}
      {loaded && !source.url && !source.error && <p role="status">Loading · {source.progress}%</p>}
      {source.url && attachment.type === 'audio' && <audio controls preload="metadata" src={source.url} aria-label={label} onError={() => setPlaybackError('This browser cannot play this audio format. Try downloading it to listen in another app.')} />}
      {source.url && attachment.type === 'video' && <video controls playsInline preload="metadata" src={source.url} aria-label={label} onError={() => setPlaybackError('This browser cannot play this video format. Try downloading it to watch in another app.')} />}
      {source.url && <a className="text-button" href={source.url} download={attachment.name || 'journal-attachment'}>Download {label || 'file'}</a>}
      {source.error && <p className="editor-error" role="alert">{source.error} <button type="button" className="text-button" onClick={source.retry}>Try again</button></p>}
      {playbackError && <p className="editor-error" role="alert">{playbackError}</p>}
    </figure>
  );
}

export default function NoteMedia({ attachments }) {
  const [viewing, setViewing] = useState(null);
  const images = attachments.filter((item) => item.type === 'image');
  const links = attachments.filter((item) => item.type === 'link');
  return (
    <>
      {images.length > 0 && (
        <div className={`note-gallery ${images.length > 1 ? 'note-gallery-multiple' : ''}`}>
          {images.map((image, index) => <Photo key={`${image.url}-${index}`} image={image} onOpen={() => setViewing(index)} />)}
        </div>
      )}
      {links.map((attachment, index) => <LinkAttachment key={`${attachment.url}-${index}`} attachment={attachment} />)}
      {attachments.filter((item) => mediaId(item.url) && item.type !== 'image').map((attachment) => <FileAttachment key={attachment.assetId} attachment={attachment} />)}
      {viewing !== null && <PhotoViewer images={images} initialIndex={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
