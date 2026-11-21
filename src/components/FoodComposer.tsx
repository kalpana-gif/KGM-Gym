import { useState } from 'react';
import { Camera, Plus, Search, Trash2, Check, Save, Sparkles } from 'lucide-react';
import { useApp } from '../context';
import { FoodMark, Modal } from './ui';
import { records, remove, save } from '../lib/db';
import { parseFoodText, type Parsed } from '../lib/parser';
import { authenticatedRequest, supabase } from '../lib/cloud';
import { preparePhoto } from '../lib/photo';
import { total } from '../lib/calories';
import type { Food, LocalRecord, Meal, MealItem, PhotoDraft } from '../types';

export default function FoodComposer({ close, slot = 'lunch', meal, food }: { close: () => void; slot?: Meal['slot']; meal?: LocalRecord<Meal>; food?: Food }) {
  const a = useApp();
  const [mode, setMode] = useState<'manual' | 'text' | 'photo'>('manual');
  const [name, setName] = useState(meal?.data.name ?? '');
  const [mealSlot, setMealSlot] = useState<Meal['slot']>(meal?.data.slot ?? slot);
  const [date, setDate] = useState(meal?.data.date ?? a.date);
  const [items, setItems] = useState<MealItem[]>(meal?.data.items.map(i => ({ ...i })) ?? (food ? [{ id: crypto.randomUUID(), food, grams: 100 }] : []));
  const [search, setSearch] = useState(''); const [text, setText] = useState('');
  const [unresolved, setUnresolved] = useState<Parsed[]>([]);
  const [photo, setPhoto] = useState<{ mime: string; base64: string } | null>(null);
  const [description, setDescription] = useState('');
  const [consent, setConsent] = useState(a.profile.aiConsent);
  const [busy, setBusy] = useState(false);
  const [estimate, setEstimate] = useState<{ foods: { name: string; grams: number; kcalMin: number; kcalMax: number; assumptions: string }[]; uncertainty: string } | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [retain, setRetain] = useState(false);
  const sum = total(items);
  const add = (f: Food, grams = 100) => { setItems(prev => [...prev, { id: crypto.randomUUID(), food: f, grams }]); setSearch(''); };
  const matches = a.foods.filter(f => `${f.name} ${f.aliases.join(' ')}`.toLowerCase().includes(search.toLowerCase())).slice(0, 7);
  const parse = () => {
    const rows = parseFoodText(text, a.foods); setItems(prev => [...prev, ...rows.flatMap(r => r.item ? [r.item] : [])]);
    setUnresolved(prev => [...prev, ...rows.filter(r => !r.item)]); setText('');
  };
  const analyze = async () => {
    if (!consent) { a.toast('Please review and accept the photo-sharing explanation.'); return; }
    setBusy(true);
    await a.run(async () => {
      if (!photo) throw new Error('Choose a meal photo first.');
      const result = await authenticatedRequest('/api/analyze-food', { ...photo, description, consent: true });
      setEstimate(result);
      const profile = a.rows.find(r => r.entity === 'profiles');
      if (profile && !a.profile.aiConsent) await save(a.owner, 'profiles', { ...a.profile, aiConsent: true }, profile.id);
    });
    setBusy(false);
  };
  const storeDraft = () => a.run(async () => {
    if (!photo) throw new Error('Choose a photo first.');
    const record = await save(a.owner, 'photo_metadata', { ...photo, description, date, analyzed: false }, draftId); setDraftId(record.id);
  }, 'Photo draft saved on this device. Analyze it when you’re online.');
  const commit = () => a.run(async () => {
    if (unresolved.length) throw new Error('Resolve or explicitly remove unmatched foods before saving.');
    if (!items.length || items.some(i => !Number.isFinite(i.grams) || i.grams <= 0 || i.grams > 5000)) throw new Error('Add foods with portions between 1 and 5,000 g.');
    if (!date) throw new Error('Choose the meal date.');
    if (retain && photo) {
      if (!supabase || !a.owner.startsWith('user:')) throw new Error('Sign in before retaining a photo in private cloud storage, or turn retention off.');
      const bytes = Uint8Array.from(atob(photo.base64), c => c.charCodeAt(0));
      const path = `${a.owner.slice(5)}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('meal-photos').upload(path, bytes, { contentType: photo.mime, upsert: false });
      if (error) throw new Error('Photo retention failed. Turn it off to save the food entry without a cloud photo.');
    }
    await save(a.owner, 'meal_logs', { name: name.trim() || items.map(i => i.food.name).slice(0, 2).join(' & '), slot: mealSlot, date,
      timestamp: meal?.data.timestamp ?? new Date().toISOString(), timezone: a.profile.timezone, items }, meal?.id);
    if (draftId) { const draft = (await records(a.owner, 'photo_metadata')).find(r => r.id === draftId); if (draft) await remove(draft); }
    close();
  }, meal ? 'Meal updated.' : 'Meal saved. Your daily totals are updated.');
  const draftRows = a.rows.filter(r => r.entity === 'photo_metadata');
  return <Modal title={meal ? 'Review your meal' : 'What’s on your plate?'} close={close} wide>
    <div className="tabs" role="group" aria-label="Meal entry method">{(['manual', 'text', 'photo'] as const).map(v => <button key={v} aria-pressed={mode === v} className={mode === v ? 'active' : ''} onClick={() => setMode(v)}>{v === 'manual' ? <Search size={16} /> : v === 'text' ? <Plus size={16} /> : <Camera size={16} />}{v === 'manual' ? 'Search foods' : v === 'text' ? 'Type a meal' : 'Meal photo'}</button>)}</div>
    {mode === 'manual' && <><label className="search-field"><Search size={18} /><input aria-label="Search foods" placeholder="Rice, parippu, chicken curry…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="food-results">{matches.map(f => <button key={f.id} className="food-result" onClick={() => add(f)}><FoodMark food={f} /><span><strong>{f.name}</strong><small>{Math.round(f.kcal)} kcal / 100 g · {f.state}</small></span><Plus size={17} /></button>)}</div>{!matches.length && <p className="subtext">No match. Add a custom food from the Food screen, or select a familiar alternative.</p>}</>}
    {mode === 'text' && <><label>Describe your meal<textarea rows={3} placeholder="150 g cooked red rice, 100 g chicken curry, and 2 eggs" value={text} onChange={e => setText(e.target.value)} /></label><p className="fineprint">Works offline for known foods. Grams are best; cups and plates need a serving selection.</p><button className="btn secondary" disabled={!text.trim()} onClick={parse}><Plus size={16} />Review foods</button></>}
    {mode === 'photo' && <div className="photo-section">
      <label className="photo-picker">{photo ? <img src={`data:${photo.mime};base64,${photo.base64}`} alt="Your meal draft" /> : <><Camera size={30} /><strong>Take or choose a meal photo</strong><span>JPEG, PNG or WebP · up to 12 MB before resizing</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) void a.run(async () => { setPhoto(await preparePhoto(f)); setEstimate(null); setDraftId(undefined); }); }} /></label>
      <label>Optional description<textarea placeholder="What’s in the curry? Any extra oil or coconut milk?" value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label className="checkbox"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>Send this meal photo and description to Google Gemini. Free-tier content may be used to improve its products. My identity, health profile and diary are excluded.</span></label>
      <div className="button-row"><button className="btn primary" disabled={busy || !photo || !consent} onClick={() => void analyze()}><Sparkles size={16} />{busy ? 'Estimating…' : 'Estimate with AI'}</button><button className="btn secondary" disabled={!photo} onClick={() => void storeDraft()}><Save size={16} />Save offline draft</button></div>
      {!a.owner.startsWith('user:') && <button className="text-btn" onClick={a.openAccount}>Sign in to use online AI →</button>}
      <p className="fineprint">A photo cannot reveal exact portions or hidden ingredients. Confirm catalog foods and edit grams before saving. Recognition requires internet.</p>
      {draftRows.length > 0 && <details className="details"><summary>Saved photo drafts ({draftRows.length})</summary>{draftRows.map(r => <div className="button-row" key={r.id}><button className="text-btn" onClick={() => { const d = r.data as PhotoDraft; setPhoto({ mime: d.mime, base64: d.base64 }); setDescription(d.description); setDate(d.date); setDraftId(r.id); setEstimate(null); }}>Open {((r.data as PhotoDraft).description || 'meal draft').slice(0, 40)} · {(r.data as PhotoDraft).date}</button><button className="icon-btn" aria-label="Delete photo draft" onClick={() => void a.run(() => remove(r), 'Photo draft deleted.')}><Trash2 size={15} /></button></div>)}</details>}
      {estimate && <div className="estimate-box"><h3>AI suggestions · please review</h3><p>{estimate.uncertainty}</p>{estimate.foods.map((f, i) => <div key={i} className="ai-item"><strong>{f.name} · about {Math.round(f.grams)} g</strong><small>{Math.round(f.kcalMin)}–{Math.round(f.kcalMax)} kcal · AI estimate</small><p>{f.assumptions}</p><label>Confirm a catalog match<select defaultValue="" onChange={e => { const match = a.foods.find(x => x.id === e.target.value); if (match) add(match, f.grams); e.target.value = ''; }}><option value="">Choose food to add to review…</option>{a.foods.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>)}</div>}
      {photo && <label className="checkbox"><input type="checkbox" checked={retain} onChange={e => setRetain(e.target.checked)} /><span>Also retain this photo in my private cloud storage. Optional; requires sign-in and connectivity.</span></label>}
    </div>}
    {unresolved.length > 0 && <div className="warning"><strong>These entries need a choice</strong>{unresolved.map((row, i) => <div key={i}><p>“{row.text}” · {row.reason}</p><div className="button-row"><select aria-label={`Resolve ${row.text}`} defaultValue="" onChange={e => { const f = a.foods.find(x => x.id === e.target.value); if (f) { add(f); setUnresolved(rows => rows.filter((_, j) => j !== i)); } }}><option value="">Choose food · then edit grams</option>{a.foods.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select><button className="icon-btn" aria-label={`Remove unmatched ${row.text}`} onClick={() => setUnresolved(rows => rows.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div></div>)}</div>}
    <div className="review-section"><h3>Your meal review <span className="badge">{Math.round(sum.kcal)} kcal</span></h3>{items.length === 0 && <p className="subtext">Add a food above to begin.</p>}
      {items.map(i => <div className="review-item" key={i.id}><FoodMark food={i.food} /><div className="review-food"><strong>{i.food.name}</strong><small>{i.food.uncertainty} · {i.food.state}</small><details><summary>Nutrition source</summary><p className="fineprint">{i.food.source}</p>{i.food.instructions && <p className="fineprint">{i.food.instructions}</p>}</details></div><div className="portion"><label>Grams<input type="number" min="1" max="5000" step="1" value={i.grams || ''} onChange={e => setItems(rows => rows.map(r => r.id === i.id ? { ...r, grams: +e.target.value } : r))} /></label><select aria-label={`Serving for ${i.food.name}`} value="" onChange={e => { const grams = +e.target.value; if (grams) setItems(rows => rows.map(r => r.id === i.id ? { ...r, grams } : r)); }}><option value="">Use serving…</option>{i.food.servings.map((s, j) => <option value={s.grams} key={j}>{s.label} · {s.grams} g{s.approximate ? ' approx.' : ''}</option>)}</select></div><button className="icon-btn" aria-label={`Remove ${i.food.name}`} onClick={() => setItems(rows => rows.filter(r => r.id !== i.id))}><Trash2 size={16} /></button></div>)}
    </div>
    <div className="form-grid"><label>Meal name<input placeholder="e.g. Rice & curry" value={name} onChange={e => setName(e.target.value)} /></label><label>Meal<select value={mealSlot} onChange={e => setMealSlot(e.target.value as Meal['slot'])}>{['breakfast', 'lunch', 'dinner', 'snacks'].map(s => <option key={s} value={s}>{s}</option>)}</select></label><label>Diary date<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><div className="macro-summary">{Math.round(sum.protein)} g protein · {Math.round(sum.carbs)} g carbs · {Math.round(sum.fat)} g fat</div></div>
    <div className="button-row composer-actions"><button className="btn primary" disabled={!items.length || busy} onClick={() => void commit()}><Check size={17} />Confirm & {meal ? 'update' : 'save'} meal</button>{meal && <><button className="btn secondary" onClick={() => void a.run(async () => {
      if (!date || !items.length || unresolved.length || items.some(i => !Number.isFinite(i.grams) || i.grams <= 0 || i.grams > 5000)) throw new Error('Choose a diary date, resolve foods and enter valid portions before copying.');
      await save(a.owner, 'meal_logs', { ...meal.data, name: name.trim() || meal.data.name, slot: mealSlot, date, timestamp: new Date().toISOString(), items: items.map(i => ({ ...i, id: crypto.randomUUID() })) }); close();
    }, 'Meal copied to the selected diary day.')}><Plus size={16} />Copy to {date}</button><button className="btn danger" onClick={() => void a.run(async () => { await remove(meal); close(); }, 'Meal deleted. Restore it from the Food screen if needed.')}><Trash2 size={16} />Delete</button></>}</div>
  </Modal>;
}
