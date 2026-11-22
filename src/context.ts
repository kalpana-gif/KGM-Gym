import { createContext, useContext } from 'react';
import type { Conflict, Food, LocalRecord, Meal, Profile, Target } from './types';
import type { CloudSyncState } from './lib/cloud';
export type AppContext = {
  owner: string; rows: LocalRecord[]; profile: Profile; date: string; setDate: (s: string) => void;
  target?: Target; foods: Food[]; toast: (s: string) => void;
  run: (task: () => Promise<unknown>, message?: string) => Promise<void>;
  openProfile: () => void; openAccount: () => void;
  openFood: (slot?: Meal['slot'], meal?: LocalRecord<Meal>, food?: Food) => void;
  navigate: (page: string) => void; conflicts: Conflict[];
  syncState: CloudSyncState; syncNow: () => Promise<void>;
};
export const Context = createContext<AppContext | null>(null);
export function useApp() { const value = useContext(Context); if (!value) throw new Error('Missing app context'); return value; }
