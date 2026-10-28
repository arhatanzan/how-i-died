export default function ArchiveStatus({ status, error, onRetry }) {
  if (status === 'loading') {
    return <p role="status" className="archive-loading">Opening the pages…</p>;
  }
  if (status === 'error') {
    return (
      <div className="archive-error" role="alert">
        <p>The journal couldn’t connect to its archive.</p>
        <p>{error || 'Check the connection and try again.'}</p>
        <button type="button" className="btn-outline" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  return null;
}
