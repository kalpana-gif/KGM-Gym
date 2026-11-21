import { useState } from 'react';
import { Cloud, Download, LogOut, Trash2, RefreshCw } from 'lucide-react';
import { useApp } from '../context';
import { Modal } from './ui';
import { authenticatedRequest, cloudConfigured, supabase, sync } from '../lib/cloud';
import { clearOwner, conflicts, dismissConflict, importOwner, pending, records, save } from '../lib/db';
import { total } from '../lib/calories';
import type { Conflict, Meal } from '../types';

export default function AccountPanel({ close, guestOwner, rotateGuest }: { close: () => void; guestOwner: string; rotateGuest: () => void }) {
  const a = useApp(); const [email,setEmail] = useState(''); const [sent,setSent] = useState(false); const [confirmation,setConfirmation] = useState('');
  const [pendingCount,setPending] = useState<number | null>(null);
  const loggedIn = a.owner.startsWith('user:');
  const download = (name: string, content: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([content],{ type:mime }));
    const el = document.createElement('a'); el.href=url; el.download=name; el.click(); window.setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  return <Modal title="Your account & data" close={close}>
    <div className="account-status"><Cloud size={24} /><div><strong>{loggedIn ? 'Signed in · cloud sync available' : 'Device-only guest mode'}</strong><p>{loggedIn ? 'Private records belong to your account.' : 'Your diary is stored locally in this browser.'}</p></div></div>
    {!cloudConfigured && <div className="notice">Cloud services are not configured yet. Guest logging and calculations work. Follow the README to add the Supabase project settings and enable AI.</div>}
    {!loggedIn && cloudConfigured && <form onSubmit={e => { e.preventDefault(); void a.run(async () => {
      const { error } = await supabase!.auth.signInWithOtp({ email, options:{ emailRedirectTo:window.location.origin } });
      if (error) throw error; setSent(true);
    }, 'Check your email for a sign-in link.'); }}><label>Email address<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className="btn primary full">Send sign-in link</button>{sent && <p className="fineprint">Open the link on this device to connect your account.</p>}</form>}
    {loggedIn && <><div className="button-row"><button className="btn primary" onClick={() => void a.run(async () => { const result = await sync(a.owner); setPending((await pending(a.owner)).length); a.toast(result); })}><RefreshCw size={16} />Sync now</button><button className="btn secondary" onClick={() => void a.run(async () => {
      setPending((await pending(a.owner)).length);
      await supabase!.auth.signOut({ scope:'local' }); rotateGuest(); close();
    },'Signed out. Your previous account cache is locked to that account.')}><LogOut size={16} />Sign out</button></div>{pendingCount !== null && <p className="fineprint">{pendingCount} queued changes. Unsynced account changes stay on this device after sign-out and resume when that account signs in again.</p>}
      <button className="text-btn" onClick={() => void a.run(async () => { await importOwner(guestOwner,a.owner); await sync(a.owner); },'Guest records imported once; existing record IDs were preserved.')}><Download size={16} />Import my earlier guest diary</button></>}
    {a.conflicts.length > 0 && <div className="warning"><h3>Conflicting edits need review</h3><p>The server version is active. Your local version is preserved below.</p>{a.conflicts.map(c => <div key={c.id}><p>{c.record.entity} · {c.record.modifiedAt}</p><details><summary>Compare versions</summary><p>Local: {JSON.stringify(c.record.data)}</p><p>Server: {JSON.stringify(c.remote.data)}</p></details><div className="button-row"><button className="btn secondary" onClick={() => void a.run(async () => { await save(a.owner,c.record.entity,c.record.data,c.record.id,c.record.deleted); await dismissConflict(c.id); },'Your local version is queued as a new change.')} >Restore my local edit</button><button className="text-btn" onClick={() => void a.run(() => dismissConflict(c.id),'Server version kept.')} >Keep server version</button></div></div>)}</div>}
    <h3 className="settings-heading">Take your data with you</h3><div className="button-row"><button className="btn secondary" onClick={() => void a.run(async () => { const all = await records(a.owner,undefined,true); download('kgm-fit-export.json',JSON.stringify({ version:1,exportedAt:new Date().toISOString(),records:all },null,2),'application/json'); })}><Download size={16} />Export JSON</button><button className="btn secondary" onClick={() => {
      const escape = (s: unknown) => `"${String(s).replace(/"/g,'""')}"`;
      const rows = a.rows.filter(r => r.entity === 'meal_logs').map(r => { const m=r.data as Meal; const n=total(m.items); return [m.date,m.slot,m.name,n.kcal.toFixed(1),n.protein.toFixed(1),n.carbs.toFixed(1),n.fat.toFixed(1)].map(escape).join(','); });
      download('kgm-fit-meals.csv',['date,meal,name,kcal,protein_g,carbs_g,fat_g',...rows].join('\n'),'text/csv');
    }}><Download size={16} />Export meals CSV</button></div>
    <p className="fineprint">Local browser data can be lost if you clear site storage or use private browsing. Export a backup or enable cloud sync. JSON exports can include retained local photo drafts; keep exports private.</p>
    {loggedIn && <button className="text-btn" onClick={() => void a.run(async () => {
      while (true) {
        const { data,error }=await supabase!.storage.from('meal-photos').list(a.owner.slice(5),{ limit:100 });
        if (error) throw error; if (!data?.length) break;
        const { error: removeError }=await supabase!.storage.from('meal-photos').remove(data.map(f=>`${a.owner.slice(5)}/${f.name}`));
        if (removeError) throw removeError;
      }
    },'All retained cloud meal photos were deleted.')}><Trash2 size={16} />Delete retained cloud photos</button>}
    <details className="details"><summary>Delete {loggedIn ? 'account and all data' : 'this guest diary'}</summary><p>This removes {loggedIn ? 'your account, cloud records, retained cloud photos and this account’s local cache' : 'this guest diary, drafts and local records'}. Export anything you want to keep first.</p><label>Type DELETE to confirm<input value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button className="btn danger full" disabled={confirmation !== 'DELETE'} onClick={() => void a.run(async () => {
      if (loggedIn) { await authenticatedRequest('/api/delete-account',{ confirm:'DELETE' }); await supabase!.auth.signOut({ scope:'local' }); }
      await clearOwner(a.owner); rotateGuest(); close();
    }, 'Data deletion completed.')}><Trash2 size={16} />Permanently delete</button></details>
  </Modal>;
}
