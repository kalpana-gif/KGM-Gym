import { useEffect, useState } from 'react';
import { Check, Play, Pause, RotateCcw, Footprints, Dumbbell } from 'lucide-react';
import { useApp } from '../context';
import { addDays, dateLabel } from '../lib/calories';
import { workoutFor } from '../data/workouts';
import { save } from '../lib/db';
import { FitnessArt, SectionHead } from '../components/ui';
import type { Session } from '../types';

export default function Workouts() {
  const a = useApp(); const [selected, setSelected] = useState(0);
  const dates = Array.from({ length: 7 }, (_,i) => addDays(a.date,i));
  const date = dates[selected]; const w = workoutFor(new Date(`${date}T12:00Z`).getUTCDay(), a.profile);
  const [seconds, setSeconds] = useState(60); const [running, setRunning] = useState(false);
  const [done, setDone] = useState<string[]>([]); const [minutes, setMinutes] = useState(w.minutes);
  const [performance, setPerformance] = useState<Record<string, { sets: number; reps: number }>>({});
  useEffect(() => { setMinutes(w.minutes); setDone([]); setPerformance({}); }, [date,a.profile.equipment]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds(s => { if (s <= 1) { setRunning(false); return 0; } return s - 1; }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const sessions = a.rows.filter(r => r.entity === 'workout_sessions').sort((x,y) => (y.data as Session).date.localeCompare((x.data as Session).date));
  return <>
    <div className="page-heading"><div><p className="eyebrow">MOVE MORE. FEEL BETTER.</p><h1>Build a little momentum<span>.</span></h1><p>A beginner-friendly week, with space to rest and recover.</p></div><button className="btn secondary" onClick={a.openProfile}>Equipment & preferences</button></div>
    <div className="day-tabs" role="group" aria-label="Workout days">{dates.map((d,i) => <button key={d} aria-pressed={i === selected} className={i === selected ? 'active' : ''} onClick={() => setSelected(i)}><span>{dateLabel(d,{ weekday: 'short' })}</span><strong>{new Date(`${d}T12:00Z`).getUTCDate()}</strong></button>)}</div>
    <section className="workout-hero"><span className="mini-icon electric">{w.strength ? <Dumbbell size={25} /> : <Footprints size={25} />}</span><div className="workout-hero-copy"><p className="eyebrow">{dateLabel(date)}</p><h2>{w.name}</h2><p>{w.description}</p><span className="pill">{w.minutes || 'Rest'}{w.minutes ? ' minutes to start' : ''} · {a.profile.equipment === 'gym' ? 'Gym options' : 'At home'}</span></div><FitnessArt/></section>
    {w.caution && <p className="warning">{w.caution}</p>}
    <div className="workout-layout"><div>
      <SectionHead title={w.exercises.length ? 'Your movements' : 'Keep it comfortable'} text={w.exercises.length ? 'Two gentle sets. Quality before quantity.' : 'Walk where you feel safe; take breaks whenever needed.'} />
      {w.exercises.map((e,i) => <section className="card exercise-card" key={e.name}><div className="exercise-head"><span className="exercise-number">{String(i+1).padStart(2,'0')}</span><div><h3>{e.name}</h3><p>{e.sets} sets · {e.reps} reps · rest 60–90 sec</p></div><button className={`check-btn ${done.includes(e.name) ? 'checked' : ''}`} aria-label={`Mark ${e.name} completed`} aria-pressed={done.includes(e.name)} onClick={() => setDone(rows => rows.includes(e.name) ? rows.filter(n => n !== e.name) : [...rows,e.name])}><Check size={18} /></button></div><p>{e.instructions}</p><small>Easier option: {e.easier}</small><div className="form-grid"><label>Sets completed<input type="number" min="0" max="10" value={performance[e.name]?.sets ?? e.sets} onChange={v => setPerformance(prev => ({ ...prev,[e.name]: { sets: +v.target.value, reps: prev[e.name]?.reps ?? e.reps } }))} /></label><label>Reps per set<input type="number" min="0" max="100" value={performance[e.name]?.reps ?? e.reps} onChange={v => setPerformance(prev => ({ ...prev,[e.name]: { reps: +v.target.value, sets: prev[e.name]?.sets ?? e.sets } }))} /></label></div></section>)}
      {!w.exercises.length && <section className="card"><p>{a.profile.injuries.trim() ? 'Follow your existing clinician-approved routine. Avoid trying new movements that aggravate your injury.' : 'Start with a short, comfortable walk. For mobility, try slow shoulder circles and ankle movements within a pain-free range.'}</p></section>}
    </div><aside><section className="card rest-timer"><p className="eyebrow">TAKE YOUR TIME</p><h3>Rest timer</h3><strong role="timer" aria-label="Rest time remaining">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong><div className="button-row"><button className="btn primary" onClick={() => { if (!seconds) setSeconds(60); setRunning(!running); }}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? 'Pause' : 'Start'}</button><button className="icon-btn" aria-label="Reset rest timer" onClick={() => { setRunning(false); setSeconds(60); }}><RotateCcw size={17} /></button></div><p className="fineprint">Add time if you need it. You set the pace.</p></section><section className="card"><h3>Log your session</h3><label>Minutes moved<input type="number" min="0" max="300" value={minutes} onChange={e => setMinutes(+e.target.value)} /></label><button className="btn primary full" onClick={() => void a.run(async () => {
      if (minutes < 0 || minutes > 300) throw new Error('Enter valid session minutes.');
      await save(a.owner, 'workout_sessions', { date, name: w.name, minutes, completed: true, exercises: w.exercises.filter(e => done.includes(e.name)).map(e => ({ name: e.name, ...performance[e.name] ?? { sets: e.sets,reps: e.reps } })) });
    }, 'Session logged. A little movement counts.')}><Check size={16} />Save session</button></section></aside></div>
    <div className="card guidance"><h3>Progress gently</h3><p>When all sets feel comfortable over two sessions, add one or two repetitions or a little resistance. Increase walking a few minutes at a time. Work toward general adult guidance of 150–300 minutes of moderate activity per week and strength on at least two days, when appropriate.</p><p className="fineprint">Stop for chest pain, faintness or unusually severe symptoms and seek appropriate help. This general schedule requires review for injuries or relevant conditions. Exercise calories are not added to your food budget.</p></div>
    <SectionHead title="Your movement history" text="Every completed session is part of the picture." />{sessions.length ? sessions.slice(0,12).map(r => <div className="card restore-row" key={r.id}><div><strong>{(r.data as Session).name}</strong><p>{(r.data as Session).date} · {(r.data as Session).minutes} min · {(r.data as Session).exercises.length} exercises recorded</p></div><Check size={19} /></div>) : <p className="subtext">Your first logged session will appear here.</p>}
  </>;
}
