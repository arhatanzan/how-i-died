import { memo, useState } from 'react';
import { getAttachments } from '../../shared/attachments';
import { formatShort, formatTime } from '../lib/dates';
import { moodOf } from '../lib/moods';
import { NOTE_TEXT_PREVIEW_CLAMP } from '../lib/constants';
import MoodIcon from './MoodIcon';
import NoteEditor from './NoteEditor';
import NoteContent from './NoteContent';
import NoteMedia from './NoteMedia';

function NoteCard({ note, isAdmin, onUpdate, onDelete, delay = 0, index = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const attachments = getAttachments(note);
  const mood = moodOf(note.mood);
  const isLongText = note.text.length > NOTE_TEXT_PREVIEW_CLAMP;
  const preview = note.text.slice(0, NOTE_TEXT_PREVIEW_CLAMP).replace(/https?:\/\/\S*$/, '').trimEnd();
  const displayText = isLongText && !expanded ? `${preview}…` : note.text;
  const hasImages = attachments.some((item) => item.type === 'image');

  async function executeAction(action) {
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

  function handleToggleVisibility() {
    executeAction(() => onUpdate(note.id, { isPublic: !note.isPublic }));
  }

  function handleDelete() {
    executeAction(() => onDelete(note.id));
  }

  function handleStartEdit() {
    setError('');
    setEditing(true);
  }

  function handleFinishEdit(input) {
    onUpdate(note.id, input);
    setEditing(false);
  }

  return (
    <article
      className={`journal-note ${hasImages ? 'journal-note-visual' : 'journal-note-written'} note-variation-${index % 3}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="note-heading">
        <time dateTime={note.createdAt} title={formatTime(note.createdAt)}>
          {formatShort(note.createdAt)}
        </time>
        <span className="note-mood" title={mood.label}>
          <MoodIcon mood={mood.key} />
          <span className="sr-only">{mood.label}</span>
        </span>
        {isAdmin && <span className="note-visibility">{note.isPublic ? 'Public' : 'Private'}</span>}
        {isAdmin && note.featured && (
          <span className="note-featured" title="Featured">
            <span aria-hidden="true">☆</span>
            <span className="sr-only">Featured</span>
          </span>
        )}
      </header>

      {editing ? (
        <NoteEditor
          note={note}
          onSave={handleFinishEdit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <NoteMedia attachments={attachments} />
          {note.text && (
            <div className="note-copy"><NoteContent text={displayText} /></div>
          )}
          {isLongText && (
            <button
              type="button"
              className="note-read-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Fold away ↑' : 'Read the rest ↗'}
            </button>
          )}
        </>
      )}

      {isAdmin && !editing && (
        <footer className="note-actions">
          {confirming ? (
            <>
              <span>Remove this moment?</span>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
                Keep
              </button>
              <button
                type="button"
                className="text-danger"
                disabled={busy}
                onClick={handleDelete}
              >
                {busy ? 'Removing…' : 'Delete'}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={handleToggleVisibility}>
                {note.isPublic ? 'Make private' : 'Publish'}
              </button>
              <button type="button" disabled={busy} onClick={handleStartEdit}>
                Edit
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(true)}>
                Delete
              </button>
            </>
          )}
        </footer>
      )}

      {error && (
        <p className="editor-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export default memo(NoteCard);
