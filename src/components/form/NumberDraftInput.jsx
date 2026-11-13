import { useState } from 'react';

// Number field that only reports valid numbers. While the user is typing, the
// raw text is kept locally, so an empty or half-typed value ("", "1.") never
// reaches the data. `onCommit(number)` is called for every valid input.
export function NumberDraftInput({ value, onCommit, integer = false, min, ...props }) {
  const [draft, setDraft] = useState(null); // null = not editing, show `value`

  const handleChange = (e) => {
    const raw = e.target.value;
    setDraft(raw);
    const n = Number(raw);
    const valid = raw.trim() !== ''
      && Number.isFinite(n)
      && (!integer || Number.isInteger(n))
      && (min === undefined || n >= Number(min));
    if (valid && n !== Number(value)) onCommit(n);
  };

  return (
    <input
      type="number"
      min={min}
      {...props}
      value={draft !== null ? draft : value}
      onChange={handleChange}
      onBlur={() => setDraft(null)}
    />
  );
}
