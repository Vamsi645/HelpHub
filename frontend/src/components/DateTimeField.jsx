import { useRef } from 'react';

export default function DateTimeField({ name, value, onChange, min, required = false }) {
  const inputRef = useRef(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  }

  return (
    <div className="date-time-control">
      <input ref={inputRef} name={name} type="datetime-local" min={min} value={value} onChange={onChange} required={required} />
      <button className="calendar-button" type="button" onClick={openPicker} aria-label="Open calendar" title="Open calendar">
        Calendar
      </button>
    </div>
  );
}
