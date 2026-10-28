import { memo, useState } from 'react';
import { getAttachments, splitLinks } from '../../shared/attachments';
import { formatShort, formatTime } from '../lib/dates';
import { moodOf } from '../lib/moods';
import MoodIcon from './MoodIcon';
import NoteEditor from './NoteEditor';
import NoteMedia from './NoteMedia';

const CLAMP = 700;

function NoteCard({ note, isAdmin, onUpdate, onDelete, delay = 0, index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attachments = getAttachments(note);
  const mood = moodOf(note.mood);
  const long = note.text.length > CLAMP;
  const preview = note.text.slice(0, CLAMP).replace(/https?:\/\/\S*$/, '').trimEnd();
  const shown = long && !expanded ? `${preview}…` : note.text;
  const hasImages = attachments.some((item) => item.type === 'image');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`journal-note ${hasImages ? 'journal-note-visual' : 'journal-note-written'} note-variation-${index % 3}`} style={{ animationDelay: `${delay}ms` }}>
      <header className="note-heading">
        <time dateTime={note.createdAt} title={formatTime(note.createdAt)}>{formatShort(note.createdAt)}</time>
        <span className="note-mood" title={mood.label}><MoodIcon mood={mood.key} /><span className="sr-only">{mood.label}</span></span>
        {isAdmin && <span className="note-visibility">{note.isPublic ? 'Public' : 'Private'}</span>}
        {isAdmin && note.featured && <span className="note-featured" title="Featured"><span aria-hidden="true">☆</span><span className="sr-only">Featured</span></span>}
      </header>
      {editing ? (
        <NoteEditor note={note} onSave={async (input) => { await onUpdate(note.id, input); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <NoteMedia attachments={attachments} />
          {note.text && (
            <p className="note-copy">
              {splitLinks(shown).map((part, i) => part.url
                ? <a key={i} href={part.url} target="_blank" rel="noopener noreferrer">{part.text}</a>
                : part.text)}
            </p>
          )}
          {long && <button type="button" className="note-read-more" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? 'Fold away ↑' : 'Read the rest ↗'}</button>}
        </>
      )}
      {isAdmin && !editing && (
        <footer className="note-actions">
          {confirming ? (
            <>
              <span>Remove this moment?</span>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Keep</button>
              <button type="button" className="text-danger" disabled={busy} onClick={() => run(() => onDelete(note.id))}>{busy ? 'Removing…' : 'Delete'}</button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => run(() => onUpdate(note.id, { isPublic: !note.isPublic }))}>{note.isPublic ? 'Make private' : 'Publish'}</button>
              <button type="button" disabled={busy} onClick={() => { setError(''); setEditing(true); }}>Edit</button>
              <button type="button" disabled={busy} onClick={() => setConfirming(true)}>Delete</button>
            </>
          )}
        </footer>
      )}
      {error && <p className="editor-error" role="alert">{error}</p>}
    </article>
  );
}

export default memo(NoteCard);
