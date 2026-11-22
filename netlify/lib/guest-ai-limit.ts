type Entry = { day: string; count: number; last: number; recent: number[]; pending: boolean };
type Decision = { allowed: true } | { allowed: false; retryAfter: number; daily: boolean };
const dayFor = (time: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);

export function createGuestLimiter() {
  const entries = new Map<string, Entry>();
  return {
    consume(identity: string, now = Date.now()): Decision {
      const day = dayFor(now);
      let entry = entries.get(identity);
      if (!entry || entry.day !== day) {
        // Bound process memory. Netlify's independent edge rule also limits requests.
        if (entries.size >= 10_000) {
          for (const [key, row] of entries) if (row.day !== day && !row.pending) entries.delete(key);
          if (entries.size >= 10_000 && !entries.has(identity)) return { allowed: false, retryAfter: 60, daily: false };
        }
        if (entry?.pending) return { allowed: false, retryAfter: 10, daily: false };
        entry = { day, count: 0, last: -Infinity, recent: [], pending: false };
        entries.set(identity, entry);
      }
      if (entry.count >= 15) {
        const tomorrow = new Date(`${day}T00:00:00+05:30`).getTime() + 86_400_000;
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((tomorrow - now) / 1000)), daily: true };
      }
      entry.recent = entry.recent.filter(time => now - time < 60_000);
      if (entry.pending || now - entry.last < 10_000 || entry.recent.length >= 3) {
        const wait = entry.recent.length >= 3 ? 60_000 - (now - entry.recent[0]) : 10_000 - (now - entry.last);
        return { allowed: false, retryAfter: Math.max(1, Math.ceil(wait / 1000)), daily: false };
      }
      entry.count++; entry.last = now; entry.recent.push(now); entry.pending = true;
      return { allowed: true };
    },
    release(identity: string) {
      const entry = entries.get(identity);
      if (entry) entry.pending = false;
    },
  };
}

export const guestAiLimiter = createGuestLimiter();
