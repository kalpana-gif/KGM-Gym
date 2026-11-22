import { afterEach, describe, expect, it, vi } from 'vitest';
import { authLinkError, inboxLink, readSignInRequest, signInError, storedAccountOwner, storeSignInRequest } from './account';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('email sign-in recovery', () => {
  it('retains the cached account diary when its access token expires without treating storage as backend verification', () => {
    const id = 'bb47df1f-e28c-437f-9b44-537b8d37e4a0';
    let value = JSON.stringify({ user: { id }, access_token: 'expired-test-token', refresh_token: 'test-refresh', expires_at: 1 });
    vi.stubGlobal('localStorage', { getItem: () => value });
    expect(storedAccountOwner('session')).toBe(`user:${id}`);
    value = JSON.stringify({ user: { id }, access_token: 'token' });
    expect(storedAccountOwner('session')).toBeNull();
    value = '{broken';
    expect(storedAccountOwner('session')).toBeNull();
  });

  it('keeps a pending request available after reopening and discards expired or malformed state', () => {
    const storage = new Map<string,string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key,value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.useFakeTimers(); vi.setSystemTime(1800000000000);
    const request = { email: 'test@example.com', sentAt: Date.now(), retryAt: Date.now() + 60000 };
    storeSignInRequest(request);
    vi.advanceTimersByTime(30000);
    expect(readSignInRequest()?.retryAt).toBeGreaterThan(Date.now());
    expect(readSignInRequest()?.email).toBe('test@example.com');
    vi.advanceTimersByTime(60*60*1000);
    expect(readSignInRequest()).toBeNull();
    storage.set('kgm-fit-sign-in-request','{broken');
    expect(readSignInRequest()).toBeNull();
    storeSignInRequest(null);
    expect(storage.size).toBe(0);
  });

  it('leaves authentication usable when browser preference storage fails', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
    expect(readSignInRequest()).toBeNull();
    expect(() => storeSignInRequest({ email:'test@example.com', sentAt:0, retryAt:60000 })).not.toThrow();
  });

  it('handles expired fragment and query callbacks without showing raw provider error text', () => {
    expect(authLinkError(new URL('https://app.example/#error=access_denied&error_code=otp_expired'))).toMatch(/expired or was already used/);
    expect(authLinkError(new URL('https://app.example/?error=access_denied&error_description=private-debug-data'))).toMatch(/Request a new link/);
    expect(authLinkError(new URL('https://app.example/?error=access_denied&error_description=private-debug-data'))).not.toContain('private-debug-data');
    expect(authLinkError(new URL('https://app.example/food'))).toBeNull();
  });

  it('explains provider cooldowns and email delivery restrictions', () => {
    expect(signInError({status:429})).toMatch(/wait a minute/);
    expect(signInError({code:'email_address_not_authorized'})).toMatch(/not enabled for this address/);
    expect(signInError(new Error('network failure'))).toMatch(/Check your connection/);
  });

  it('opens only recognized inbox providers without including the email address in the URL', () => {
    expect(inboxLink('TEST@GMAIL.COM')?.url).toBe('https://mail.google.com/');
    expect(inboxLink('test@outlook.com')?.url).toBe('https://outlook.live.com/mail/');
    expect(inboxLink('test@gmail.com.evil.example')).toBeNull();
  });
});
