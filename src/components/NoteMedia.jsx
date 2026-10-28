import { useEffect, useRef, useState } from 'react';
import { getEmbed } from '../../shared/attachments';

function Photo({ image, onOpen }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="photo-unavailable" role="status">
        <p>This photo couldn’t be loaded.</p>
        <a href={image.url} target="_blank" rel="noopener noreferrer">Open original photo ↗</a>
        <button type="button" className="text-button" onClick={() => setFailed(false)}>Try again</button>
      </div>
    );
  }
  return (
    <figure className="note-photo">
      <button type="button" onClick={onOpen} aria-label={`Enlarge photo: ${image.alt || 'journal photo'}`}>
        <img src={image.url} alt={image.alt || ''} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </button>
      {image.alt && <figcaption>{image.alt}</figcaption>}
    </figure>
  );
}

function PhotoViewer({ images, initialIndex, onClose }) {
  const dialog = useRef(null);
  const [index, setIndex] = useState(initialIndex);
  const image = images[index];

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
        <img key={image.url} src={image.url} alt={image.alt || 'Journal photo'} />
        <figcaption>{image.alt || 'A moment kept.'}</figcaption>
      </figure>
      {images.length > 1 && (
        <div className="viewer-navigation">
          <button type="button" onClick={() => move(-1)} aria-label="Previous photo">←</button>
          <span aria-live="polite">{index + 1} / {images.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next photo">→</button>
        </div>
      )}
      <a href={image.url} target="_blank" rel="noopener noreferrer">Open original ↗</a>
    </dialog>
  );
}

function LinkAttachment({ attachment }) {
  const [loaded, setLoaded] = useState(false);
  const embed = getEmbed(attachment.url);
  const hostname = new URL(attachment.url).hostname.replace(/^www\./, '');
  const label = attachment.title || (embed ? `A little ${embed.kind === 'audio' ? 'listening' : 'watching'}` : hostname);
  
  useEffect(() => {
    if (loaded && embed?.provider === 'Instagram' && window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [loaded, embed?.provider]);
  
  if (embed?.provider === 'Instagram') {
    return (
      <div className="note-link note-embed note-embed-video">
        {loaded ? (
          <>
            <blockquote 
              className="instagram-media" 
              data-instgrm-permalink={attachment.url}
              style={{
                backgroundColor: 'var(--color-paper)',
                border: '1px solid var(--color-line)',
                borderRadius: '3px',
                boxShadow: '0 0 1px rgba(0,0,0,0.5), 0 1px 10px rgba(0,0,0,0.15)',
                margin: '1px',
                maxWidth: '540px',
                minWidth: '326px',
                padding: '0',
                width: '99.375%'
              }}
            />
            <script async src="//www.instagram.com/embed.js"></script>
          </>
        ) : (
          <button type="button" className="embed-cover" onClick={() => setLoaded(true)}>
            <span className="embed-play" aria-hidden="true">▷</span>
            <span>Load Instagram</span>
            <small>Connects to Instagram only when you choose.</small>
          </button>
        )}
        <a className="note-link-caption" href={attachment.url} target="_blank" rel="noopener noreferrer">
          <span><small>Instagram</small><strong>{label}</strong></span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    );
  }
  
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
      {viewing !== null && <PhotoViewer images={images} initialIndex={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
