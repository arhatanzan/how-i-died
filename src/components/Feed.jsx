import NoteCard from './NoteCard';

export default function Feed({ notes, layout, isAdmin, onUpdate, onDelete, freshIds, emptyText = 'Nothing written here yet.' }) {
  if (!notes.length) {
    return (
      <div className="journal-empty animate-in">
        <span aria-hidden="true">✳</span>
        <p>{emptyText}</p>
        <small>There’s room for the next little thing.</small>
      </div>
    );
  }
  return (
    <div className={`journal-feed journal-feed-${layout}`} aria-label="Journal entries">
      {notes.map((note, index) => (
        <NoteCard key={note.id} note={note} index={index} isAdmin={isAdmin} onUpdate={onUpdate} onDelete={onDelete} delay={freshIds?.has(note.id) ? 0 : Math.min(index, 6) * 55} />
      ))}
    </div>
  );
}
