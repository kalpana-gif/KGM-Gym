import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, TrendingDown, CalendarDays, Utensils } from 'lucide-react';
import { useApp } from '../context';
import { addDays, dateLabel, localDate, total } from '../lib/calories';
import { save } from '../lib/db';
import { Empty, SectionHead } from '../components/ui';
import type { Meal, Weight } from '../types';

export default function Progress() {
  const reduce = useReducedMotion();
  const a = useApp(); const [kg, setKg] = useState(String(a.profile.weight)); const [date, setDate] = useState(a.date);
  const weights = a.rows.filter(r => r.entity === 'weight_entries').map(r => r.data as Weight).sort((x,y) => x.date.localeCompare(y.date));
  const latest = weights.at(-1); const change = weights.length > 1 ? latest!.kg - weights[0].kg : null;
  const mealRows = a.rows.filter(r => r.entity === 'meal_logs');
  const days = Array.from({ length: 7 }, (_,i) => addDays(a.date, i - 6)).map(date => ({ date, kcal: total(mealRows.filter(r => (r.data as Meal).date === date).flatMap(r => (r.data as Meal).items)).kcal }));
  const max = Math.max(...days.map(d => d.kcal), a.target?.kcal ?? 1);
  const dayCounts = new Set(mealRows.map(r => (r.data as Meal).date)).size;
  const plotted = weights.slice(-30);
  const low = Math.min(...plotted.map(w => w.kg)) - .5; const high = Math.max(...plotted.map(w => w.kg)) + .5;
  const firstTime = plotted.length ? new Date(plotted[0].date).getTime() : 0;
  const lastTime = plotted.length ? new Date(plotted.at(-1)!.date).getTime() : 1;
  const coords = plotted.map(w => ({ x: plotted.length === 1 ? 300 : 30 + (new Date(w.date).getTime() - firstTime) / Math.max(1,lastTime-firstTime) * 540, y: 160 - (w.kg-low) / (high-low) * 130 }));
  return <>
    <div className="page-heading"><div><p className="eyebrow">LOOK AT THE BIGGER PICTURE</p><h1>Progress takes a little time<span>.</span></h1><p>Watch the trend. Celebrate the habits you’re building.</p></div></div>
    <div className="progress-stats">{[{ icon: TrendingDown, label: 'Latest weight', value: `${latest?.kg ?? a.profile.weight} kg` },{ icon: CalendarDays, label: 'Change since first entry', value: change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)} kg` },{ icon: Utensils,label: 'Days with meals logged',value: String(dayCounts) }].map(s => <section className="card" key={s.label}><s.icon size={22} /><p>{s.label}</p><strong>{s.value}</strong></section>)}</div>
    <div className="progress-layout"><section className="card weight-chart"><SectionHead title="Your weight trend" text="The latest 30 entries, spaced by date." />{weights.length ? <><svg viewBox="0 0 600 190" role="img" aria-label="Weight entries over time"><path d="M30 160H570M30 95H570M30 30H570" stroke="var(--border)" strokeDasharray="4 5" /><motion.polyline points={coords.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" initial={reduce?false:{pathLength:0}} animate={{pathLength:1}} transition={{duration:reduce?0:.6}} />{coords.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--accent)"><title>{plotted[i].date}: {plotted[i].kg} kg</title></circle>)}</svg><div className="chart-labels"><span>{plotted[0].date}</span><span>{plotted.at(-1)!.date}</span></div></> : <Empty title="Start your trend" text="A weigh-in gives you a starting point. Compare several weeks, not individual days." />}</section><section className="card"><h3>Log a weigh-in</h3><form onSubmit={e => { e.preventDefault(); void a.run(async () => {
      const value = +kg; if (!Number.isFinite(value) || value < 30 || value > 350) throw new Error('Enter a weight between 30 and 350 kg.');
      const old = a.rows.find(r => r.entity === 'weight_entries' && (r.data as Weight).date === date);
      await save(a.owner,'weight_entries',{ date,kg:value },old?.id);
      if (date === localDate(a.profile.timezone)) {
        const profile = a.rows.find(r => r.entity === 'profiles');
        if (profile) await save(a.owner,'profiles',{ ...a.profile,weight:value },profile.id);
      }
    }, 'Weigh-in saved. Review your calculator if you want to update the target.'); }}><label>Weight · kg<input type="number" min="30" max="350" step=".1" required value={kg} onChange={e => setKg(e.target.value)} /></label><label>Date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><button className="btn primary full"><Plus size={16} />Save weigh-in</button></form><p className="fineprint">Weigh under similar conditions. A new weight does not silently change your approved calorie target.</p></section></div>
    <section className="card"><SectionHead title="A week of food awareness" text="Logged calories, not assumed consumption." /><div className="bar-chart">{days.map(d => <div key={d.date}><strong>{Math.round(d.kcal)}</strong><div className="bar-area"><motion.i initial={reduce?false:{height:0}} animate={{height:`${d.kcal/max*100}%`}} transition={{duration:reduce?0:.5}} /></div><span>{dateLabel(d.date,{ weekday:'short' })}</span></div>)}</div></section>
    {weights.length > 0 && <details className="details"><summary>Weigh-in history</summary>{weights.slice().reverse().map(w => <div className="restore-row" key={w.date}><span>{w.date}</span><strong>{w.kg} kg</strong></div>)}</details>}
    <p className="fineprint">Goal-date projections are omitted because weight change is uncertain. Use several weeks of data and review your plan with a professional when needed.</p>
  </>;
}
