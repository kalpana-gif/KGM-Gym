export type SignInRequest = { email: string; sentAt: number; retryAt: number };
const requestKey = 'kgm-fit-sign-in-request';

// The cached owner selects this device's diary only. Backend access still
// requires Supabase to refresh and verify the session before synchronization.
export function storedAccountOwner(storageKey: string): string | null {
  try {
    const session = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const id = session?.user?.id;
    return typeof id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) &&
      typeof session.access_token === 'string' && session.access_token &&
      typeof session.refresh_token === 'string' && session.refresh_token
      ? `user:${id}` : null;
  } catch { return null; }
}

export function readSignInRequest(): SignInRequest | null {
  try {
    const request = JSON.parse(localStorage.getItem(requestKey) ?? 'null');
    if (typeof request?.email === 'string' && Number.isFinite(request.sentAt) &&
        Number.isFinite(request.retryAt) && Date.now() - request.sentAt < 60 * 60 * 1000) return request;
  } catch { /* The sign-in form still works when storage is unavailable. */ }
  return null;
}

export function storeSignInRequest(request: SignInRequest | null) {
  try {
    if (request) localStorage.setItem(requestKey, JSON.stringify(request));
    else localStorage.removeItem(requestKey);
  } catch { /* A failed local preference write must not interrupt authentication. */ }
}

export function signInError(error: unknown): string {
  const details = error as { status?: number; code?: string; message?: string };
  if (details.status === 429 || /rate.limit|after \d+ seconds/i.test(details.message ?? '')) {
    return 'Please wait a minute before requesting another link. If a link already arrived, use the newest email.';
  }
  if (/email_address_invalid|email_address_not_authorized/.test(details.code ?? '')) {
    return details.code === 'email_address_invalid'
      ? 'Check your email address and try again.'
      : 'Email delivery is not enabled for this address yet. Your diary is still saved on this device.';
  }
  return 'We couldn’t send your link. Check your connection and try again. Your diary is still saved on this device.';
}

export function authLinkError(url: URL): string | null {
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = hash.get('error_code') ?? url.searchParams.get('error_code');
  const error = hash.get('error') ?? url.searchParams.get('error');
  if (!code && !error) return null;
  return code === 'otp_expired'
    ? 'This sign-in link has expired or was already used. Request a new link below.'
    : 'This sign-in link didn’t work. Request a new link below and open the newest email.';
}

export function inboxLink(email: string): { label: string; url: string } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain === 'gmail.com' || domain === 'googlemail.com') return { label: 'Open Gmail', url: 'https://mail.google.com/' };
  if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) return { label: 'Open Outlook', url: 'https://outlook.live.com/mail/' };
  if (domain === 'yahoo.com') return { label: 'Open Yahoo Mail', url: 'https://mail.yahoo.com/' };
  return null;
}
