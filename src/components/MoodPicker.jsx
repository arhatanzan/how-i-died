import { MOODS } from '../lib/moods';
import MoodIcon from './MoodIcon';

export default function MoodPicker({ value, onChange, allowNone = false, showLabels = false }) {
  return (
    <div className="mood-picker" role="radiogroup" aria-label="Mood">
      {MOODS.map((m) => {
        const active = value === m.key;
        return (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={m.label}
            title={m.label}
            onClick={() => onChange(active && allowNone ? null : m.key)}
            className="mood-choice"
          >
            <MoodIcon mood={m.key} />
            {(showLabels || active) && <span>{m.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
