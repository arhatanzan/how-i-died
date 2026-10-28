import { api } from '../lib/api';
import NoteEditor from './NoteEditor';

export default function Composer({ onCreated }) {
  async function save(input) {
    const note = await api.createNote(input);
    onCreated(note);
  }
  return <div className="journal-composer"><NoteEditor onSave={save} /></div>;
}
