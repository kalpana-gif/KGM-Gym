import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDays, dateLabel, localDate } from '../lib/calories';
import { calendarDays, calendarMonth, moveCalendarMonth, validCalendarDate } from '../lib/calendar';

const months = Array.from({ length: 12 }, (_, month) => dateLabel(`2026-${String(month + 1).padStart(2, '0')}-01`, { month: 'long' }));

export default function DatePicker({ value, onChange, label = 'Diary date', timezone = 'Asia/Colombo', navigation = false }: {
  value: string; onChange: (date: string) => void; label?: string; timezone?: string; navigation?: boolean;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const today = localDate(timezone);
  useEffect(() => setDraft(value), [value]);
  const close = () => {
    setOpen(false);
    // Restore focus after the dialog is removed, including when opened by
    // clicking the editable field rather than the calendar button.
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  return <div className={`date-picker ${navigation ? 'date-control' : 'date-picker-form'}`}>
    {navigation && <button type="button" className="icon-btn date-step" aria-label="Previous diary day" onClick={() => onChange(addDays(value, -1))}><ChevronLeft size={19} /></button>}
    <div className="date-picker-field">
      <div className="date-picker-copy">
        <label htmlFor={id}>{navigation ? `${value === today ? 'Today' : label} · ${dateLabel(value, { weekday: 'long' })}` : label}</label>
        <input id={id} type="text" aria-label={label} aria-describedby={`${id}-hint`} value={draft}
          autoComplete="off" spellCheck={false} placeholder="YYYY-MM-DD" maxLength={10}
          onClick={() => setOpen(true)}
          onChange={event => { const next = event.target.value; setDraft(next); if (validCalendarDate(next)) onChange(next); }}
          onBlur={() => { if (!validCalendarDate(draft)) setDraft(value); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'Enter') { event.preventDefault(); setOpen(true); }
          }} />
      </div>
      <button ref={trigger} type="button" className="date-calendar-trigger" aria-label={`Open ${label.toLowerCase()} calendar`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <CalendarDays size={20} /><ChevronDown size={14} />
      </button>
      <span className="sr-only" id={`${id}-hint`}>Enter a date as YYYY-MM-DD, or open the calendar to choose a date.</span>
    </div>
    {navigation && <button type="button" className="icon-btn date-step" aria-label="Next diary day" onClick={() => onChange(addDays(value, 1))}><ChevronRight size={19} /></button>}
    {open && createPortal(<Calendar value={value} today={today} label={label} choose={date => { onChange(date); close(); }} close={close} />, document.body)}
  </div>;
}

function Calendar({ value, today, label, choose, close }: {
  value: string; today: string; label: string; choose: (date: string) => void; close: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [month, setMonth] = useState(() => calendarMonth(value));
  const [focused, setFocused] = useState(value);
  const [moveFocus, setMoveFocus] = useState(false);
  const days = calendarDays(month);
  const year = Number(month.slice(0, 4));
  const years = Array.from({ length: Math.max(Number(today.slice(0, 4)) + 10, year) - Math.min(1900, year) + 1 }, (_, index) => Math.min(1900, year) + index);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.querySelector<HTMLButtonElement>(`[data-date="${value}"]`)?.focus({ preventScroll: true });
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  useEffect(() => {
    if (!moveFocus) return;
    dialog.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus({ preventScroll: true });
    setMoveFocus(false);
  }, [focused, moveFocus]);
  const browse = (next: string) => {
    setMonth(calendarMonth(next));
    setFocused(next);
  };
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const next = event.key === 'ArrowLeft' ? addDays(date, -1) : event.key === 'ArrowRight' ? addDays(date, 1)
      : event.key === 'ArrowUp' ? addDays(date, -7) : event.key === 'ArrowDown' ? addDays(date, 7)
      : event.key === 'Home' ? addDays(date, -day) : event.key === 'End' ? addDays(date, 6 - day)
      : event.key === 'PageUp' ? moveCalendarMonth(date, event.shiftKey ? -12 : -1)
      : event.key === 'PageDown' ? moveCalendarMonth(date, event.shiftKey ? 12 : 1) : null;
    if (!next || !validCalendarDate(next)) return;
    event.preventDefault(); browse(next); setMoveFocus(true);
  };
  return <dialog ref={dialog} className="calendar-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
    <div className="calendar-header"><div><p className="eyebrow">{label}</p><h2 id={`${id}-title`}>Choose a date</h2></div><button type="button" className="icon-btn" aria-label="Close calendar" onClick={close}><X size={20} /></button></div>
    <p id={`${id}-description`} className="sr-only">Choose a day. Use arrow keys to move between dates, Page Up or Page Down to change months, and Escape to close.</p>
    <div className="calendar-navigation">
      <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => browse(moveCalendarMonth(focused, -1))}><ChevronLeft size={19} /></button>
      <div className="calendar-month-select">
        <select aria-label="Calendar month" value={Number(month.slice(5, 7))} onChange={event => browse(`${year}-${event.target.value.padStart(2, '0')}-01`)}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
        <select aria-label="Calendar year" value={year} onChange={event => browse(`${event.target.value.padStart(4, '0')}-${month.slice(5, 7)}-01`)}>{years.map(value => <option key={value} value={value}>{value}</option>)}</select>
      </div>
      <button type="button" className="icon-btn" aria-label="Next month" onClick={() => browse(moveCalendarMonth(focused, 1))}><ChevronRight size={19} /></button>
    </div>
    <div className="calendar-grid" role="grid" aria-label={dateLabel(month, { month: 'long', year: 'numeric' })}>
      <div role="row" className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span role="columnheader" key={day}>{day}</span>)}</div>
      {Array.from({ length: 6 }, (_, week) => <div role="row" className="calendar-week" key={week}>{days.slice(week * 7, week * 7 + 7).map(date => <div role="gridcell" aria-selected={date === value} key={date}>
        <button type="button" data-date={date} tabIndex={date === focused ? 0 : -1}
          className={`calendar-day ${date.slice(0, 7) !== month.slice(0, 7) ? 'other-month' : ''} ${date === value ? 'selected' : ''} ${date === today ? 'is-today' : ''}`}
          aria-label={dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          aria-current={date === today ? 'date' : undefined}
          onFocus={() => setFocused(date)} onKeyDown={event => navigate(event, date)} onClick={() => choose(date)}>
          {Number(date.slice(-2))}<span className="calendar-today-dot" aria-hidden="true" />
        </button>
      </div>)}</div>)}
    </div>
    <div className="calendar-footer"><div><span className="calendar-legend"><i />Today</span><p>{dateLabel(value, { day: 'numeric', month: 'short', year: 'numeric' })}</p></div><button type="button" className="btn primary" onClick={() => choose(today)}>Back to today</button></div>
  </dialog>;
}
