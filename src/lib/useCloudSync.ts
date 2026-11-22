import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudSyncError, sync, type CloudSyncState } from './cloud';
import { pending } from './db';

export function useCloudSync(owner: string, guestOwner: string, authRevision: number) {
  const [state, setState] = useState<CloudSyncState>({ owner, status: 'device', message: 'Saved on this device', pending: 0 });
  const requestRef = useRef<() => Promise<void>>(async () => {});
  const syncNow = useCallback(() => requestRef.current(), []);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let running: Promise<void> | undefined;
    let changedDuringSync = false;
    let resumeDuringSync = false;
    let succeeded = false;
    let failures = 0;
    let lastSyncedAt: string | undefined;
    const publish = (next: Omit<CloudSyncState, 'owner'>) => {
      if (active) setState({ owner, ...next, lastSyncedAt });
    };
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (active) timer = window.setTimeout(() => { void request(); }, delay);
    };
    const perform = async () => {
      if (!owner.startsWith('user:')) return;
      const ops = await pending(owner);
      if (!active) return;
      if (!navigator.onLine) {
        publish({ status: 'offline', pending: ops.length, message: 'Offline. Changes will sync to Supabase when you reconnect.' });
        return;
      }
      publish({ status: 'syncing', pending: ops.length, message: 'Synchronizing with Supabase…' });
      try {
        const result = await sync(owner, guestOwner, () => active);
        if (!active) return;
        succeeded = true;
        failures = 0;
        if (!result.pending && !result.conflicts) lastSyncedAt = result.syncedAt;
        publish({
          status: result.conflicts ? 'conflict' : result.pending ? 'syncing' : 'synced',
          pending: result.pending,
          message: result.conflicts ? 'Review conflicting edits to finish synchronization.'
            : result.pending ? 'New changes are waiting to sync.' : 'All saved changes are synced to Supabase.',
        });
        schedule(result.pending ? 250 : 60000);
      } catch (error) {
        if (!active) return;
        const ops = await pending(owner);
        publish({
          status: navigator.onLine ? 'error' : 'offline', pending: ops.length,
          message: error instanceof CloudSyncError ? error.message : 'Cloud sync was interrupted. Saved changes will retry automatically.',
        });
        failures++;
        // Recover without needing a new edit or pressing a button.
        schedule(error instanceof CloudSyncError && error.kind !== 'temporary' ? 60000 : Math.min(5000 * 2 ** (failures - 1), 60000));
      }
    };
    const request = () => {
      if (running) { resumeDuringSync = true; return running; }
      window.clearTimeout(timer);
      changedDuringSync = false; succeeded = false;
      running = perform().catch(() => {
        publish({ status: 'error', pending: 0, message: 'Couldn’t read the saved synchronization queue. Reload to try again.' });
        schedule(60000);
      }).finally(() => {
        running = undefined;
        if (active && resumeDuringSync) {
          resumeDuringSync = false;
          schedule(0);
        } else if (active && succeeded && changedDuringSync) void pending(owner).then(ops => {
          if (active && ops.length) schedule(250);
        }).catch(() => {});
      });
      return running;
    };
    requestRef.current = request;
    const changed = () => { if (running) changedDuringSync = true; else schedule(250); };
    const resume = () => { void request(); };
    const visible = () => { if (document.visibilityState === 'visible') resume(); };
    if (owner.startsWith('user:')) {
      publish({ status: 'checking', pending: 0, message: 'Verifying your account and checking Supabase…' });
      schedule(0);
      window.addEventListener('lankafit-data', changed);
      window.addEventListener('online', resume);
      window.addEventListener('offline', resume);
      window.addEventListener('focus', resume);
      document.addEventListener('visibilitychange', visible);
    } else publish({ status: 'device', pending: 0, message: 'Saved on this device' });
    return () => {
      active = false; window.clearTimeout(timer);
      window.removeEventListener('lankafit-data', changed);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [owner, guestOwner]);
  useEffect(() => { if (authRevision) void requestRef.current(); }, [authRevision]);
  return {
    syncState: state.owner === owner ? state : { owner, status: owner.startsWith('user:') ? 'checking' : 'device', pending: 0, message: 'Checking saved changes…' } as CloudSyncState,
    syncNow,
  };
}
