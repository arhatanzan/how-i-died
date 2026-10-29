CREATE TABLE journal_notes (
  id text PRIMARY KEY,
  document jsonb NOT NULL,
  CONSTRAINT journal_note_object CHECK (jsonb_typeof(document) = 'object'),
  CONSTRAINT journal_note_id CHECK (document->>'id' IS NOT NULL AND document->>'id' = id),
  CONSTRAINT journal_note_visibility CHECK (jsonb_typeof(document->'isPublic') = 'boolean')
);

CREATE INDEX journal_notes_created_at ON journal_notes ((document->>'createdAt') DESC, id);
CREATE INDEX journal_notes_public ON journal_notes ((document->>'createdAt') DESC, id)
  WHERE document->'isPublic' = 'true'::jsonb;

CREATE TABLE journal_migrations (
  name text PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now(),
  note_count integer NOT NULL CHECK (note_count >= 0)
);
