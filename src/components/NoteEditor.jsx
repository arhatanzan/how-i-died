import { useEffect, useId, useRef, useState } from 'react';
import { getAttachments, MAX_ATTACHMENTS, normalizeWebUrl, validateAttachments } from '../../shared/attachments';
import { toLocalInput } from '../lib/dates';
import { FILE_ACCEPT, fileMetadata, formatBytes } from '../../shared/media';
import { uploadFile } from '../lib/media';
import MediaCapture from './MediaCapture';
import { useMediaUrl } from '../lib/useMediaUrl';
import MoodPicker from './MoodPicker';
import MediaPlayer from './MediaPlayer';
import NoteContent from './NoteContent';

function DraftAttachment({ item }) {
  const [preview, setPreview] = useState(item.url);
  const saved = useMediaUrl(item, !item.file && item.type === 'image');
  useEffect(() => {
    if (!item.file) {
      setPreview(item.url);
      return;
    }
    const url = URL.createObjectURL(item.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [item.file, item.url]);
  if (item.type === 'link') return <a href={item.url} target="_blank" rel="noopener noreferrer">{new URL(item.url).hostname} ↗</a>;
  if (!item.file && item.type !== 'image') return <p className="draft-file-name">{item.name} · Ready to save</p>;
  if (!item.file && saved.error) return <p className="editor-error" role="alert">{saved.error}<button type="button" className="text-button" onClick={saved.retry}>Try again</button></p>;
  if (!item.file) return saved.url ? <img src={saved.url} alt={item.alt || 'Photo preview'} /> : <p role="status">Loading photo…</p>;
  if (item.type === 'image') return <img src={preview} alt={item.alt || 'Photo preview'} />;
  if (item.type === 'audio' || item.type === 'video') return <MediaPlayer type={item.type} src={preview} label={`${item.type === 'audio' ? 'Audio' : 'Video'} attachment preview`} />;
  return <p className="draft-file-name">{item.name} · {formatBytes(item.size)}</p>;
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
  const [capture, setCapture] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const fileInput = useRef(null);
  const textarea = useRef(null);

  useEffect(() => {
    const area = textarea.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.max(area.scrollHeight, 120)}px`;
  }, [text, previewing]);

  function applyInlineFormat(prefix, suffix = prefix) {
    const area = textarea.current;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = text.slice(start, end);
    const alreadyFormatted = start >= prefix.length
      && text.slice(start - prefix.length, start) === prefix
      && text.slice(end, end + suffix.length) === suffix;
    const nextStart = alreadyFormatted ? start - prefix.length : start + prefix.length;
    const nextEnd = alreadyFormatted ? end - prefix.length : end + prefix.length;
    const nextText = alreadyFormatted
      ? `${text.slice(0, start - prefix.length)}${selected}${text.slice(end + suffix.length)}`
      : `${text.slice(0, start)}${prefix}${selected || 'text'}${suffix}${text.slice(end)}`;
    const cursor = alreadyFormatted
      ? [nextStart, nextEnd]
      : selected
        ? [nextStart, nextEnd]
        : [start + prefix.length, start + prefix.length + 4];

    setText(nextText);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(...cursor);
    });
  }

  function applyLineFormat(prefix) {
    const area = textarea.current;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = text.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    const selectedLines = text.slice(lineStart, lineEnd);
    const lines = selectedLines.split('\n');
    const shouldRemove = lines.every((line) => line.startsWith(prefix));
    const formattedLines = lines.map((line) => shouldRemove ? line.slice(prefix.length) : `${prefix}${line}`);
    const replacement = formattedLines.join('\n');
    const nextText = `${text.slice(0, lineStart)}${replacement}${text.slice(lineEnd)}`;
    const cursor = [lineStart, lineStart + replacement.length];

    setText(nextText);
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(...cursor);
    });
  }

  function handleEditorKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const key = event.key.toLowerCase();
      const formats = { b: ['**', '**'], i: ['*', '*'], u: ['++', '++'] };
      if (formats[key]) {
        event.preventDefault();
        applyInlineFormat(...formats[key]);
        return;
      }
      if (key === 'x' && event.shiftKey) {
        event.preventDefault();
        applyInlineFormat('~~', '~~');
        return;
      }
      if (event.key === 'Enter') event.currentTarget.form.requestSubmit();
    }
  }

  function addFiles(files) {
    setDragging(false);
    if (busy) return;
    setError('');
    try {
      const selected = Array.from(files);
      if (selected.length + attachments.length > MAX_ATTACHMENTS) throw new Error(`Keep up to ${MAX_ATTACHMENTS} attachments in one note.`);
      const additions = selected.map((file) => ({ id: crypto.randomUUID(), ...fileMetadata(file), file, alt: '', title: '' }));
      setAttachments((items) => [...items, ...additions]);
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
    if (busy || capture) return;
    setError('');
    if (linkUrl.trim()) {
      setShowLink(true);
      setError('Add the pending link to your note first, or clear the link field.');
      return;
    }
    if (!text.trim() && !attachments.length) {
      setError('Add some text, an attachment, or a link.');
      return;
    }
    setBusy(true);
    try {
      const savedAttachments = [];
      let fileNumber = 0;
      const uploads = attachments.filter((item) => item.file).length;
      for (const item of attachments) {
        let url = item.url;
        let uploaded = {};
        if (item.file) {
          fileNumber++;
          uploaded = await uploadFile(item.file, (percent) => setProgress(`Uploading file ${fileNumber} of ${uploads}: ${percent}%…`));
          url = uploaded.url;
          // Keep completed uploads in the draft so a failed save can be retried without uploading twice.
          setAttachments((items) => items.map((current) => current.id === item.id ? { ...current, ...uploaded, file: undefined } : current));
        }
        savedAttachments.push({ ...item, ...uploaded, url });
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
        <div className="editor-mode" role="group" aria-label="Note editor view">
          <button type="button" aria-pressed={!previewing} onClick={() => setPreviewing(false)}>Write</button>
          <button type="button" aria-pressed={previewing} onClick={() => setPreviewing(true)}>Preview</button>
        </div>
        {previewing ? (
          <div className="note-editor-preview note-copy" aria-label="Formatted note preview">
            {text ? <NoteContent text={text} /> : <p className="editor-preview-empty">Nothing to preview yet.</p>}
          </div>
        ) : (
          <>
            <div className="note-formatting" role="toolbar" aria-label="Text formatting">
              {[
                { label: 'Bold', symbol: 'B', prefix: '**', suffix: '**', style: 'format-bold', shortcut: 'Ctrl+B' },
                { label: 'Italic', symbol: 'I', prefix: '*', suffix: '*', style: 'format-italic', shortcut: 'Ctrl+I' },
                { label: 'Underline', symbol: 'U', prefix: '++', suffix: '++', style: 'format-underline', shortcut: 'Ctrl+U' },
                { label: 'Strikethrough', symbol: 'S', prefix: '~~', suffix: '~~', style: 'format-strike', shortcut: 'Ctrl+Shift+X' },
              ].map((format) => (
                <button key={format.label} type="button" className={format.style} aria-label={format.label} title={`${format.label} (${format.shortcut})`} onMouseDown={(event) => event.preventDefault()} onClick={() => applyInlineFormat(format.prefix, format.suffix)}>
                  {format.symbol}
                </button>
              ))}
              <span className="formatting-divider" aria-hidden="true" />
              <button type="button" aria-label="Heading" title="Heading" onMouseDown={(event) => event.preventDefault()} onClick={() => applyLineFormat('## ')}>H</button>
              <button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyLineFormat('- ')}>•</button>
              <button type="button" aria-label="Numbered list" title="Numbered list" onMouseDown={(event) => event.preventDefault()} onClick={() => applyLineFormat('1. ')}>1.</button>
              <button type="button" aria-label="Quote" title="Quote" onMouseDown={(event) => event.preventDefault()} onClick={() => applyLineFormat('> ')}>“</button>
            </div>
            <textarea id={`${id}-text`} ref={textarea} value={text} onChange={(event) => setText(event.target.value)} placeholder="A thought, a small joy, something you don’t want to forget…" maxLength={20000} onKeyDown={handleEditorKeyDown} />
          </>
        )}
        {attachments.length > 0 && (
          <div className="draft-attachments">
            {attachments.map((item, index) => (
              <div className="draft-attachment" key={item.id}>
                <DraftAttachment item={item} />
                <label>
                  <span className="sr-only">{item.type === 'image' ? `Photo ${index + 1} description` : `Attachment ${index + 1} title`}</span>
                  <input value={(item.type === 'image' ? item.alt : item.title) || ''} onChange={(event) => setAttachments((items) => items.map((current) => current.id === item.id ? { ...current, [item.type === 'image' ? 'alt' : 'title']: event.target.value } : current))} maxLength={item.type === 'image' ? 500 : 200} placeholder={item.type === 'image' ? 'A caption / image description…' : 'Give this attachment a title…'} />
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
            <div className="editor-link-actions">
              <button type="button" className="btn-outline" onClick={addLink}>Add to note</button>
              <button type="button" className="text-button" onClick={() => { setLinkUrl(''); setLinkTitle(''); setShowLink(false); }}>Cancel</button>
            </div>
            <p className="editor-hint">YouTube, Vimeo, Spotify, and SoundCloud become click-to-load players. Other URLs become link cards.</p>
          </div>
        )}
        {showDate && <label className="editor-date"><span className="label">Date and time</span><input type="datetime-local" className="field" value={when} max={toLocalInput(new Date())} onChange={(event) => setWhen(event.target.value)} /></label>}
        <div className="editor-tools">
          <div className="editor-attachment-tools">
            <button type="button" className="text-button" onClick={() => fileInput.current.click()}>+ Upload files</button>
            <input ref={fileInput} className="sr-only" tabIndex={-1} aria-label="Upload attachments" type="file" accept={FILE_ACCEPT} multiple onChange={(event) => addFiles(event.target.files)} />
            {['photo', 'video', 'audio'].map((mode) => <button key={mode} type="button" className="text-button" disabled={attachments.length >= MAX_ATTACHMENTS} onClick={() => setCapture(mode)}>{mode === 'photo' ? 'Take photo' : `Record ${mode}`}</button>)}
            <button type="button" className="text-button" aria-expanded={showLink} onClick={() => setShowLink((current) => !current)}>+ Link / embed</button>
            <button type="button" className="text-button" aria-expanded={showDate} onClick={() => setShowDate((current) => !current)}>Date</button>
          </div>
          <span className="editor-hint">Drop files or paste photos · 250 MB per file · {attachments.length}/{MAX_ATTACHMENTS}</span>
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
      {capture && <MediaCapture mode={capture} onAdd={addFiles} onClose={() => setCapture(null)} />}
      {progress && <p className="editor-progress" role="status">{progress}</p>}
      {error && <p className="editor-error" role="alert">{error}</p>}
    </form>
  );
}
