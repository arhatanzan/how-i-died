import { useEffect, useMemo, useRef } from 'react';
import Feed from '../components/Feed';
import ArchiveStatus from '../components/ArchiveStatus';
import PersonalLanding from '../components/PersonalLanding';
import { selectFeaturedNotes } from '../lib/journal';

export default function Home({ notes, status, error, retry, isAdmin, onUpdate, onDelete, freshIds }) {
  const featured = useMemo(() => selectFeaturedNotes(notes), [notes]);
  const selectedSection = useRef(null);

  useEffect(() => {
    if (window.location.hash === '#journal-archive') selectedSection.current.scrollIntoView();
  }, []);

  return (
    <div className="home-page">
      <PersonalLanding />
      <section ref={selectedSection} id="journal-archive" className="selected-entries" aria-labelledby="selected-heading">
        <header className="selected-heading">
          <div>
            <p>Loose pages, deliberately kept</p>
            <h2 id="selected-heading">Selected entries</h2>
          </div>
          <a href="/journal">Read the whole journal ↗</a>
        </header>
        <ArchiveStatus status={status} error={error} onRetry={retry} />
        {status === 'ready' && isAdmin && featured.length === 0 && notes.length > 0 && (
          <div className="featured-prompt">
            <p>Mark notes as "Featured" to show them here on the home page.</p>
          </div>
        )}
        {status === 'ready' && (
          <Feed
            notes={featured}
            layout="masonry"
            isAdmin={isAdmin}
            onUpdate={onUpdate}
            onDelete={onDelete}
            freshIds={freshIds}
            emptyText="Featured moments will appear here."
          />
        )}
      </section>
    </div>
  );
}
