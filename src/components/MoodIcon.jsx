const EXPRESSIONS = {
  angry: <><path d="m6 7 3 1m6-1-3 1M8 16q4-4 8 0" /><path d="M8 10v1m8-1v1" /></>,
  sad: <><path d="M8 16q4-4 8 0M8 9v1m8-1v1" /><path d="M18 12q-2 3 0 3t0-3Z" /></>,
  meh: <path d="M8 9v1m8-1v1M8 15h8" />,
  calm: <path d="M6 9q2 2 4 0m4 0q2 2 4 0M9 15q3 2 6 0" />,
  happy: <path d="M6 9q2-3 4 0m4 0q2-3 4 0M7 14q5 7 10 0Z" />,
};

export default function MoodIcon({ mood }) {
  return (
    <svg className="mood-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12c.5 5-4 9-9 9s-9-4-9-9 3.5-9 9-9 9 4 9 9Z" />
      {EXPRESSIONS[mood] || EXPRESSIONS.meh}
    </svg>
  );
}
