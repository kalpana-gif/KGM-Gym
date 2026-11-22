import { useId, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Utensils } from 'lucide-react';
import { useApp } from '../context';
import { Empty } from '../components/ui';
import { addDays, dateLabel, localDate, total } from '../lib/calories';
import { mealWeek } from '../lib/history';
import type { Meal } from '../types';

const slots: { key: Meal['slot']; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];
const format = (value: number) => Math.round(value).toLocaleString('en-US');
const longDate = (date: string) => dateLabel(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default function History() {
  const a = useApp();
  const week = useMemo(() => mealWeek(a.rows, a.date), [a.rows, a.date]);
  const selected = week.days.find(day => day.date === a.date)!;
  const today = localDate(a.profile.timezone);
  const max = Math.max(1, ...week.days.map(day => day.nutrition.kcal));
  const weeklyTitle = useId();
  const dailyTitle = useId();
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">YOUR MEALS, OVER TIME</p><h1>Your food history<span>.</span></h1><p>See what you ate and how your calories add up, day by day.</p></div>
      <button className="btn primary" onClick={() => a.openFood()}><Plus size={17} />Log a meal</button>
    </div>
    <div className="history-layout">
      <section className="card history-week" aria-labelledby={weeklyTitle}>
        <div className="history-week-heading">
          <div><p className="eyebrow"><CalendarDays size={14} aria-hidden="true" />MONDAY – SUNDAY</p><h2 id={weeklyTitle}>Weekly calories</h2><p className="subtext">{dateLabel(week.start, { day: 'numeric', month: 'short', year: 'numeric' })} – {dateLabel(week.end, { day: 'numeric', month: 'short', year: 'numeric' })}</p></div>
          <div className="history-week-controls"><button className="icon-btn" aria-label="Previous week" onClick={() => a.setDate(addDays(a.date, -7))}><ChevronLeft size={18} /></button><button className="icon-btn" aria-label="Next week" onClick={() => a.setDate(addDays(a.date, 7))}><ChevronRight size={18} /></button></div>
        </div>
        <dl className="history-week-stats">
          <div><dt>Week total</dt><dd data-testid="history-week-total">{format(week.kcal)}<span>kcal</span></dd></div>
          <div><dt>Daily average</dt><dd data-testid="history-week-average">{week.loggedDays ? format(week.average) : '—'}<span>kcal / logged day</span></dd></div>
          <div><dt>Days logged</dt><dd data-testid="history-logged-days">{week.loggedDays}<span>of 7 days</span></dd></div>
        </dl>
        <div className="history-days" role="group" aria-label="Daily calories this week">
          {week.days.map(day => <button key={day.date} className={`history-day ${day.date === a.date ? 'selected' : ''}`}
            aria-pressed={day.date === a.date}
            aria-label={`${longDate(day.date)}: ${day.meals.length ? `${format(day.nutrition.kcal)} kcal, ${day.meals.length} ${day.meals.length === 1 ? 'meal' : 'meals'}` : 'no meals logged'}`}
            onClick={() => a.setDate(day.date)}>
            <span className="history-day-date"><strong>{dateLabel(day.date, { weekday: 'short' })}{day.date === today && <i aria-label="Today" />}</strong><small>{dateLabel(day.date, { day: 'numeric', month: 'short' })}</small></span>
            <span className="history-day-track" aria-hidden="true"><span style={{ width: `${day.nutrition.kcal / max * 100}%` }} /></span>
            <span className="history-day-count"><strong>{day.meals.length ? format(day.nutrition.kcal) : '—'}</strong><small>{day.meals.length ? 'kcal' : 'No meals'}</small></span>
          </button>)}
        </div>
        <p className="fineprint history-week-note">Tap a day to see its meals. The average uses days with saved meals; an empty day means nothing was logged.</p>
        <button className="text-btn history-current-week" onClick={() => a.setDate(today)}><CalendarDays size={16} />Back to today</button>
      </section>
      <section className="card history-diary" aria-labelledby={dailyTitle}>
        <div className="history-diary-heading"><div><p className="eyebrow">SELECTED DAY</p><h2 id={dailyTitle}>{longDate(a.date)}</h2><p className="subtext">{selected.meals.length} {selected.meals.length === 1 ? 'meal' : 'meals'} saved</p></div><span className="history-daily-kcal" data-testid="history-day-total">{format(selected.nutrition.kcal)}<small>kcal</small></span></div>
        <dl className="history-daily-macros">{(['protein', 'carbs', 'fat'] as const).map(key => <div key={key}><dt>{key === 'protein' ? 'Protein' : key === 'carbs' ? 'Carbs' : 'Fat'}</dt><dd>{format(selected.nutrition[key])}<small> g</small></dd></div>)}</dl>
        {selected.meals.length ? <div className="history-meals">{slots.map(slot => {
          const meals = selected.meals.filter(row => row.data.slot === slot.key);
          if (!meals.length) return null;
          return <section className="history-meal-group" key={slot.key} aria-label={slot.label}>
            <div className="history-slot-heading"><h3><Utensils size={15} aria-hidden="true" />{slot.label}</h3><span>{format(total(meals.flatMap(row => row.data.items)).kcal)} kcal</span></div>
            {meals.map(row => <button key={row.id} className="history-meal" aria-label={`Open ${row.data.name}`} onClick={() => a.openFood(slot.key, row)}>
              <span className="history-meal-copy"><strong>{row.data.name}</strong><small>{row.data.items.map(item => `${format(item.grams)} g ${item.food.name}`).join(' · ')}</small></span>
              <span className="history-meal-kcal">{format(total(row.data.items).kcal)}<small>kcal</small></span><ChevronRight size={16} aria-hidden="true" />
            </button>)}
          </section>;
        })}</div> : <Empty title="No meals saved for this day" text="Choose another day above, or log a meal for this date." action={() => a.openFood()} actionLabel="Log for this day" />}
        {selected.meals.length > 0 && <button className="btn secondary full history-add-meal" onClick={() => a.openFood()}><Plus size={17} />Add a meal for this day</button>}
      </section>
    </div>
  </>;
}
