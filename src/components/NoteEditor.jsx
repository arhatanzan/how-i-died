import { useEffect, useId, useRef, useState } from 'react';
import { getAttachments, MAX_ATTACHMENTS, normalizeWebUrl, validateAttachments } from '../../shared/attachments';
import { api } from '../lib/api';
import { toLocalInput } from '../lib/dates';
import { prepareImage, validateImageFile } from '../lib/image';
import MoodPicker from './MoodPicker';

function DraftPhoto({ item }) {
  const [preview, setPreview] = useState(item.url);
  useEffect(() => {
    if (!item.file) {
      setPreview(item.url);
      return;
    }
    const url = URL.createObjectURL(item.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file, item.url]);
  return <img src={preview} alt={item.alt || 'Photo preview'} />;
}

function initialAttachments(note) {
  return getAttachments(note || {}).map((item) => ({ ...item, id: crypto.randomUUID() }));
}

export default function NoteEditor({ note, onSave, onCancel }) {
  const id = useId();
  const [text, setText] = useState(note?.text || '');
  const [mood, setMood] = useState(note?.mood || 'meh');
  const [isPublic, setIsPublic] = useState(note?.isPublic || false);
  const [featured, setFeatured] = useState(note?.featured || false);
  const [attachments, setAttachments] = useState(() => initialAttachments(note));
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkType, setLinkType] = useState('link');
  const [showLink, setShowLink] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [when, setWhen] = useState(note ? toLocalInput(note.createdAt) : '');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const textarea = useRef(null);

  useEffect(() => {
    const area = textarea.current;
    area.style.height = 'auto';
    area.style.height = `${Math.max(area.scrollHeight, 120)}px`;
  }, [text]);

  function addFiles(files) {
    setDragging(false);
    if (busy) return;
    setError('');
    try {
      const selected = Array.from(files);
      if (selected.length + attachments.length > MAX_ATTACHMENTS) throw new Error(`Keep up to ${MAX_ATTACHMENTS} attachments in one note.`);
      selected.forEach(validateImageFile);
      setAttachments((items) => [...items, ...selected.map((file) => ({ id: crypto.randomUUID(), type: 'image', file, alt: '' }))]);
    } catch (err) {
      setError(err.message);
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  function addLink() {
    setError('');
    try {
      const url = normalizeWebUrl(linkUrl);
      if (!url) throw new Error('Paste a complete http(s) URL.');
      if (attachments.length >= MAX_ATTACHMENTS) throw new Error(`Use up to ${MAX_ATTACHMENTS} attachments per note.`);
      const [attachment] = validateAttachments([{ type: linkType, url, ...(linkType === 'image' ? { alt: linkTitle } : { title: linkTitle }) }]);
      setAttachments((items) => [...items, { ...attachment, id: crypto.randomUUID() }]);
      setLinkUrl('');
      setLinkTitle('');
      setShowLink(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (linkUrl.trim()) {
      setShowLink(true);
      setError('Add the pending link to your note first, or clear the link field.');
      return;
    }
    if (!text.trim() && !attachments.length) {
      setError('Add a few words, a photo, or a link.');
      return;
    }
    setBusy(true);
    try {
      const savedAttachments = [];
      let photoNumber = 0;
      const uploads = attachments.filter((item) => item.file).length;
      for (const item of attachments) {
        let url = item.url;
        if (item.file) {
          setProgress(`Preparing photo ${++photoNumber} of ${uploads}…`);
          const blob = await prepareImage(item.file);
          setProgress(`Uploading photo ${photoNumber} of ${uploads}…`);
          url = (await api.uploadImage(blob)).url;
          if (!url) throw new Error('The image server did not return an upload URL.');
          // Keep completed uploads in the draft so a failed save can be retried without uploading twice.
          setAttachments((items) => items.map((current) => current.id === item.id ? { ...current, url, file: undefined } : current));
        }
        savedAttachments.push(item.type === 'image' ? { type: 'image', url, alt: item.alt } : { type: 'link', url, title: item.title });
      }
      setProgress('Keeping this moment…');
      await onSave({
        text, mood, isPublic, featured,
        attachments: validateAttachments(savedAttachments),
        ...(when && (!note || when !== toLocalInput(note.createdAt)) ? { createdAt: new Date(when).toISOString() } : {}),
      });
      if (!note) {
        setText('');
        setAttachments([]);
        setWhen('');
        setShowDate(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <form
      className={`note-editor ${dragging ? 'is-dragging' : ''}`}
      onSubmit={submit}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes('Files')) {
          event.preventDefault();
          if (!busy) setDragging(true);
        }
      }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        addFiles(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.items).filter((item) => item.type.startsWith('image/')).map((item) => item.getAsFile()).filter(Boolean);
        if (files.length) {
          event.preventDefault();
          addFiles(files);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend className="editor-eyebrow">{note ? 'Tend this page' : 'A moment to keep'}</legend>
        <label className="sr-only" htmlFor={`${id}-text`}>Note</label>
        <textarea id={`${id}-text`} ref={textarea} value={text} onChange={(event) => setText(event.target.value)} placeholder="A thought, a small joy, something you don’t want to forget…" maxLength={20000} onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') event.currentTarget.form.requestSubmit();
        }} />
        {attachments.length > 0 && (
          <div className="draft-attachments">
            {attachments.map((item, index) => (
              <div className="draft-attachment" key={item.id}>
                {item.type === 'image' ? <DraftPhoto item={item} /> : <a href={item.url} target="_blank" rel="noopener noreferrer">{new URL(item.url).hostname} ↗</a>}
                <label>
                  <span className="sr-only">{item.type === 'image' ? `Photo ${index + 1} description` : `Link ${index + 1} title`}</span>
                  <input value={item.type === 'image' ? item.alt : item.title} onChange={(event) => setAttachments((items) => items.map((current) => current.id === item.id ? { ...current, [item.type === 'image' ? 'alt' : 'title']: event.target.value } : current))} maxLength={item.type === 'image' ? 500 : 200} placeholder={item.type === 'image' ? 'A caption / image description…' : 'Give this link a title…'} />
                </label>
                <button type="button" className="attachment-remove" aria-label={`Remove attachment ${index + 1}`} onClick={() => setAttachments((items) => items.filter((current) => current.id !== item.id))}>×</button>
              </div>
            ))}
          </div>
        )}
        {showLink && (
          <div className="editor-link-fields">
            <label><span className="label">Attach as</span><select className="field" value={linkType} onChange={(event) => setLinkType(event.target.value)}><option value="link">Link or embed</option><option value="image">Photo URL</option></select></label>
            <label><span className="label">URL</span><input className="field" type="url" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://…" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} /></label>
            <label><span className="label">Title / description</span><input className="field" value={linkTitle} onChange={(event) => setLinkTitle(event.target.value)} maxLength={linkType === 'image' ? 500 : 200} /></label>
            <button type="button" className="btn-outline" onClick={addLink}>Add to note</button>
            <p className="editor-hint">YouTube, Vimeo, Spotify, and SoundCloud become click-to-load players. Other URLs become link cards.</p>
          </div>
        )}
        {showDate && <label className="editor-date"><span className="label">Date and time</span><input type="datetime-local" className="field" value={when} max={toLocalInput(new Date())} onChange={(event) => setWhen(event.target.value)} /></label>}
        <div className="editor-tools">
          <div className="editor-attachment-tools">
            <button type="button" className="text-button" onClick={() => fileInput.current.click()}>+ Photos</button>
            <input ref={fileInput} className="sr-only" tabIndex={-1} aria-label="Upload photos" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(event) => addFiles(event.target.files)} />
            <button type="button" className="text-button" aria-expanded={showLink} onClick={() => setShowLink((current) => !current)}>+ Link / embed</button>
            <button type="button" className="text-button" aria-expanded={showDate} onClick={() => setShowDate((current) => !current)}>Date</button>
          </div>
          <span className="editor-hint">Drop or paste photos · {attachments.length}/{MAX_ATTACHMENTS}</span>
        </div>
        <div className="editor-bottom">
          <MoodPicker value={mood} onChange={setMood} />
          <div className="editor-submit">
            <label className="editor-visibility"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /> Public</label>
            <label className="editor-visibility"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> Featured</label>
            {onCancel && <button type="button" className="text-button" onClick={onCancel}>Cancel</button>}
            <button type="submit" className="btn-primary">{busy ? 'Saving…' : note ? 'Save changes' : 'Keep this moment'}</button>
          </div>
        </div>
      </fieldset>
      {progress && <p className="editor-progress" role="status">{progress}</p>}
      {error && <p className="editor-error" role="alert">{error}</p>}
    </form>
  );
}
