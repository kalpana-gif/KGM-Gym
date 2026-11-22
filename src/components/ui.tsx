import { useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X, Leaf, Plus, ArrowUpRight } from 'lucide-react';
import type { Food } from '../types';
import { Context } from '../context';
import BusyIndicator from './BusyIndicator';
export function Modal({ title, children, close, wide = false, busy = false, activity }: { title: string; children: ReactNode; close: () => void; wide?: boolean; busy?: boolean; activity?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const context = useContext(Context);
  const headingId = useId();
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current; el?.showModal(); document.body.style.overflow = 'hidden';
    return () => { el?.close(); if (!document.querySelector('dialog[open]')) document.body.style.overflow = ''; };
  }, []);
  return <motion.dialog ref={ref} aria-labelledby={headingId} className={`modal ${wide ? 'wide' : ''}`}
    initial={reduce ? false : { opacity: 0, y: 14, scale: .985 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: reduce ? 0 : .2, ease: [.22, 1, .36, 1] }}
    onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={e => { if (!busy && e.target === e.currentTarget) close(); }}>
    <div className="modal-head"><h2 id={headingId}>{title}</h2><button className="icon-btn" aria-label="Close dialog" disabled={busy} onClick={close}><X size={20} /></button></div>
    {(activity || context?.working&&!busy) && <div className="modal-activity">{activity || <BusyIndicator title="Updating your space…" detail="Finishing your changes." />}</div>}
    <div className="modal-body" tabIndex={0}>{children}</div>
  </motion.dialog>;
}
export function FoodMark({ food }: { food: Food }) {
  const emoji = food.group === 'grain' ? '🍚' : food.group === 'protein' ? (food.vegetarian ? '🥚' : '🐟') : food.group === 'vegetable' ? '🥬' : food.group === 'fruit' ? '🍌' : '🥥';
  return <span className={`food-mark ${food.group}`} aria-hidden="true">{emoji}</span>;
}
export function Empty({ title, text, action, actionLabel }: { title: string; text: string; action?: () => void; actionLabel?: string }) {
  return <div className="empty"><Leaf size={26} /><h3>{title}</h3><p>{text}</p>{action && <button className="btn secondary" onClick={action}><Plus size={16} />{actionLabel ?? 'Get started'}</button>}</div>;
}
export function SectionHead({ title, text, action, label }: { title: string; text?: string; action?: () => void; label?: string }) {
  return <div className="section-head"><div><h2>{title}</h2>{text && <p>{text}</p>}</div>{action && <button className="text-btn" onClick={action}>{label}<ArrowUpRight size={15} /></button>}</div>;
}
export function PlateArt() {
  const id=useId().replaceAll(':','');
  return <svg className="plate-art" viewBox="0 0 300 280" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#758178"/><stop offset=".3" stopColor="#3C4B43"/><stop offset="1" stopColor="#121C1A"/></linearGradient>
      <radialGradient id={`${id}-dish`} cx=".35" cy=".3"><stop stopColor="#374B3C"/><stop offset="1" stopColor="#162521"/></radialGradient>
      <linearGradient id={`${id}-rice`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F2EED7"/><stop offset="1" stopColor="#A9AE8E"/></linearGradient>
      <linearGradient id={`${id}-greens`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--electric)"/><stop offset="1" stopColor="var(--forest)"/></linearGradient>
      <radialGradient id={`${id}-curry`} cx=".3" cy=".25"><stop stopColor="#C5C04D"/><stop offset="1" stopColor="#576D23"/></radialGradient>
    </defs>
    <ellipse cx="157" cy="241" rx="102" ry="17" fill="var(--night)" opacity=".7"/>
    <circle cx="153" cy="140" r="104" fill={`url(#${id}-rim)`} stroke="#7E8E7880"/>
    <circle cx="153" cy="140" r="94" fill={`url(#${id}-dish)`} stroke="#71886B" strokeOpacity=".4"/>
    <circle cx="153" cy="140" r="78" fill="#1A3025" stroke="#0C1613" strokeWidth="2"/>
    <path d="M140 76C175 65 208 91 202 117C194 142 159 144 135 125C119 110 119 91 140 76Z" fill={`url(#${id}-rice)`}/>
    {Array.from({length:28},(_,i)=><path key={i} d={`M${136+(i%7)*8} ${86+Math.floor(i/7)*10+(i%2)*3}l5 1`} stroke="#FFFFEE" strokeWidth="2.5" strokeLinecap="round" opacity=".8"/>)}
    <path d="M85 117C76 92 112 87 119 114C141 96 155 119 131 141C125 163 97 168 88 149C74 147 74 128 85 117Z" fill={`url(#${id}-greens)`}/>
    <path d="M91 146l30-32m-24 24l-2-16m17 5l12 1" fill="none" stroke="#B5FF6599" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="155" cy="175" rx="31" ry="25" fill={`url(#${id}-curry)`} stroke="#E3DB6B33"/>
    {[[-10,-8],[4,-10],[14,2],[-6,10]].map(([x,y],i)=><rect key={i} x={148+x} y={168+y} width="11" height="10" rx="3" transform={`rotate(${i*15} ${155+x} ${175+y})`} fill="#BEBD63" stroke="#EBE19755"/>)}
    <ellipse cx="204" cy="157" rx="20" ry="18" fill="#879438" stroke="#B9CA4C" strokeWidth="2"/>
    <path d="M191 154l24 7m-13-17l-5 26" stroke="#CDE865" strokeWidth="2"/>
    <path d="M48 183l-9-87m-8 5l4 30m8-33l-1 34m8-33l-8 33" fill="none" stroke="#8B9C8B" strokeWidth="4" strokeLinecap="round"/>
    <path d="M268 113v85" stroke="#7F9182" strokeWidth="4" strokeLinecap="round"/><ellipse cx="268" cy="100" rx="8" ry="16" fill="#647669" stroke="#A1B09788"/>
    <path d="M90 62C131 26 201 35 233 76" fill="none" stroke="#D9E9CF" strokeWidth="2" strokeOpacity=".3" strokeLinecap="round"/>
  </svg>;
}

export function FitnessArt() {
  const id=useId().replaceAll(':','');
  return <svg className="fitness-art" viewBox="0 0 420 230" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#A9B4A7"/><stop offset=".2" stopColor="#4B5850"/><stop offset=".5" stopColor="#B6C0AF"/><stop offset=".6" stopColor="#516052"/><stop offset="1" stopColor="#242F2A"/></linearGradient>
      <linearGradient id={`${id}-rubber`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#4A584C"/><stop offset=".35" stopColor="#242E2A"/><stop offset="1" stopColor="#081215"/></linearGradient>
      <linearGradient id={`${id}-lime`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#C9FF77"/><stop offset=".45" stopColor="var(--accent)"/><stop offset="1" stopColor="var(--forest)"/></linearGradient>
    </defs>
    <ellipse cx="221" cy="181" rx="158" ry="20" fill="var(--night)" opacity=".5"/>
    <g transform="translate(55 65) rotate(-17 145 50)">
      <rect x="55" y="44" width="193" height="27" rx="8" fill={`url(#${id}-metal)`} stroke="#8E9D8880"/>
      {Array.from({length:14},(_,i)=><path key={i} d={`M${109+i*5} 47l-8 21`} stroke="#142019" strokeOpacity=".5" strokeWidth="2"/>)}
      <rect x="48" y="8" width="42" height="102" rx="11" fill={`url(#${id}-rubber)`} stroke="#55664E"/>
      <rect x="24" y="0" width="38" height="116" rx="12" fill={`url(#${id}-lime)`} stroke="#D5FFA5" strokeOpacity=".6"/>
      <rect x="16" y="17" width="18" height="83" rx="7" fill={`url(#${id}-rubber)`} stroke="#465744"/>
      <rect x="215" y="8" width="42" height="102" rx="11" fill={`url(#${id}-rubber)`} stroke="#55664E"/>
      <rect x="244" y="0" width="38" height="116" rx="12" fill={`url(#${id}-lime)`} stroke="#D5FFA5" strokeOpacity=".6"/>
      <rect x="272" y="17" width="18" height="83" rx="7" fill={`url(#${id}-rubber)`} stroke="#465744"/>
      <path d="M31 14v86m223-86v86" stroke="#EDFFD2" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round"/>
    </g>
    <path d="M300 37l8-15m7 28l17-3M71 179l-15 5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity=".65"/>
  </svg>;
}
