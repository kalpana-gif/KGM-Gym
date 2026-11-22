import { describe, expect, it } from 'vitest';
import { createGuestLimiter } from '../../netlify/lib/guest-ai-limit';

describe('guest photo request limits', () => {
  it('blocks concurrent requests, enforces spacing and isolates visitors', () => {
    const limiter = createGuestLimiter();
    const now = Date.parse('2026-11-22T06:00:00Z');
    expect(limiter.consume('a', now)).toEqual({ allowed: true });
    expect(limiter.consume('a', now + 20_000).allowed).toBe(false);
    expect(limiter.consume('b', now)).toEqual({ allowed: true });
    limiter.release('a');
    expect(limiter.consume('a', now + 5000).allowed).toBe(false);
    expect(limiter.consume('a', now + 10_000)).toEqual({ allowed: true });
  });
  it('limits bursts to three requests per minute', () => {
    const limiter = createGuestLimiter();
    const now = Date.parse('2026-11-22T06:00:00Z');
    for (const delay of [0, 10_000, 20_000]) {
      expect(limiter.consume('a', now + delay).allowed).toBe(true);
      limiter.release('a');
    }
    expect(limiter.consume('a', now + 30_000)).toEqual({ allowed: false, retryAfter: 30, daily: false });
    expect(limiter.consume('a', now + 60_000).allowed).toBe(true);
  });
  it('caps attempts per Colombo day and resets at the next local midnight', () => {
    const limiter = createGuestLimiter();
    const now = Date.parse('2026-11-22T06:00:00Z');
    for (let index = 0; index < 15; index++) {
      expect(limiter.consume('a', now + index * 61_000).allowed).toBe(true);
      limiter.release('a');
    }
    expect(limiter.consume('a', now + 15 * 61_000)).toEqual(expect.objectContaining({ allowed: false, daily: true }));
    expect(limiter.consume('a', Date.parse('2026-11-22T18:30:00Z')).allowed).toBe(true);
  });
});
