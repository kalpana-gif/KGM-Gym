import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import analyze from '../../netlify/functions/analyze-food';
import status from '../../netlify/functions/ai-status';
import { guestAiLimiter } from '../../netlify/lib/guest-ai-limit';
import { smallBody } from '../../netlify/lib/shared';

const env = { ...process.env };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const request = (body: unknown) => new Request('https://app.example/api/analyze-food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const estimate = { foods: [{ name: 'rice', grams: 150, kcalMin: 170, kcalMax: 230, proteinGrams: 4, carbsGrams: 40, fatGrams: 1, assumptions: 'Cooked rice; portion uncertain.' }], uncertainty: 'Oil and scale cannot be confirmed.' };
const success = () => response({ candidates: [{ content: { parts: [{ text: JSON.stringify(estimate) }] } }] });

beforeEach(() => {
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_PUBLISHABLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.GEMINI_API_KEY = 'ai-test-placeholder';
  process.env.AI_MODEL = 'configured-test-model';
  vi.spyOn(guestAiLimiter, 'consume').mockReturnValue({ allowed: true });
  vi.spyOn(guestAiLimiter, 'release');
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
});
function mockProvider(provider: Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('generativelanguage.googleapis.com')) return provider.clone();
    throw new Error('Unexpected request outside Gemini');
  });
}

describe('guest photo AI endpoint', () => {
  it('requires consent and a meal without requiring authentication', async () => {
    const fetch = mockProvider(success());
    expect((await analyze(request({}))).status).toBe(400);
    expect((await analyze(request({ description: 'rice', consent: false }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(200);
  });
  it('returns validated photo calories without any Supabase call or diary write', async () => {
    const fetch = mockProvider(success());
    const result = await analyze(request({ description: 'rice and curry', consent: true, mime: 'image/png', base64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64') }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(estimate);
    expect(fetch).toHaveBeenCalledOnce();
    const payload = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(payload.contents[0].parts[1].inlineData.mimeType).toBe('image/png');
    expect(payload.generationConfig.responseMimeType).toBe('application/json');
    expect(Object.keys(payload)).toEqual(['systemInstruction', 'contents', 'generationConfig']);
    expect(guestAiLimiter.release).toHaveBeenCalledOnce();
  });
  it('handles missing Gemini settings, provider exhaustion and guest rate limits', async () => {
    const fetch = mockProvider(response({}, 429));
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(429);
    process.env.GEMINI_API_KEY = '';
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(503);
    process.env.GEMINI_API_KEY = 'ai-test-placeholder';
    vi.mocked(guestAiLimiter.consume).mockReturnValue({ allowed: false, retryAfter: 10, daily: false });
    const denied = await analyze(request({ description: 'rice', consent: true }));
    expect(denied.status).toBe(429);
    expect(denied.headers.get('Retry-After')).toBe('10');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('does not let client headers choose a different quota identity', async () => {
    mockProvider(success());
    for (const forged of ['1.2.3.4', '9.8.7.6']) {
      const req = request({ description: 'rice', consent: true });
      req.headers.set('X-Forwarded-For', forged);
      await analyze(req, { ip: '192.0.2.10' });
    }
    const calls = vi.mocked(guestAiLimiter.consume).mock.calls;
    expect(calls[0][0]).toBe(calls[1][0]);
    expect(calls[0][0]).not.toContain('192.0.2.10');
  });
  it('rejects malformed images and invalid calorie or macro amounts', async () => {
    mockProvider(response({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ...estimate, foods: [{ ...estimate.foods[0], kcalMin: 300, kcalMax: 100 }] }) }] } }] }));
    expect((await analyze(request({ consent: true, mime: 'image/jpeg', base64: Buffer.from('not an image').toString('base64') }))).status).toBe(400);
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(502);
  });
  it('limits streamed body size', async () => {
    const req = request({ text: 'x'.repeat(2000) });
    await expect(smallBody(req, 100)).rejects.toThrow(/too large/);
  });
  it('reports availability using Gemini settings alone without exposing credentials', async () => {
    expect(await (await status(new Request('https://app.example/api/ai-status'))).json()).toEqual({ configured: true });
    process.env.AI_MODEL = '';
    expect(await (await status(new Request('https://app.example/api/ai-status'))).json()).toEqual({ configured: false });
    const fetch = mockProvider(success());
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses refreshed server settings instead of stale process settings for local requests', async () => {
    const fetch = mockProvider(success());
    const context = { ip: '127.0.0.1', aiSettings: { GEMINI_API_KEY: 'refreshed-test-placeholder', AI_MODEL: 'gemini-3.5-flash-lite' } };
    expect((await analyze(request({ description: 'rice', consent: true }), context)).status).toBe(200);
    expect(fetch.mock.calls[0][0]).toContain('/gemini-3.5-flash-lite:generateContent');
    const payload = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(payload.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'minimal' });
    expect(process.env.AI_MODEL).toBe('configured-test-model');
    expect(await (await status(new Request('https://app.example/api/ai-status'), context)).json()).toEqual({ configured: true });
    const cleared = { aiSettings: { GEMINI_API_KEY: '', AI_MODEL: '' } };
    expect(await (await status(new Request('https://app.example/api/ai-status'), cleared)).json()).toEqual({ configured: false });
    expect((await analyze(request({ description: 'rice', consent: true }), cleared)).status).toBe(503);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('handles unreadable estimates and a photo with no food', async () => {
    const fetch = mockProvider(response({ candidates: [{ content: { parts: [{ text: 'not JSON' }] } }] }));
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(502);
    fetch.mockResolvedValue(response({ candidates: [{ content: { parts: [{ text: '{"foods":[],"uncertainty":"Not food."}' }] } }] }));
    expect((await analyze(request({ description: 'an icon', consent: true }))).status).toBe(422);
  });
  it('releases the in-flight limit after a timeout or provider error', async () => {
    const fetch = mockProvider(response({}, 500));
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(502);
    fetch.mockRejectedValue(new DOMException('test timeout', 'TimeoutError'));
    expect((await analyze(request({ description: 'rice', consent: true }))).status).toBe(504);
    expect(guestAiLimiter.release).toHaveBeenCalledTimes(2);
  });
  it('retries a temporarily busy provider once within one guest request allowance', async () => {
    const fetch = mockProvider(success());
    fetch.mockResolvedValueOnce(response({}, 503));
    const result = await analyze(request({ description: 'rice', consent: true }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(estimate);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1]!.signal).toBe(fetch.mock.calls[1][1]!.signal);
    expect(guestAiLimiter.consume).toHaveBeenCalledOnce();
    expect(guestAiLimiter.release).toHaveBeenCalledOnce();
  });
  it('stops retrying and shows a clear busy message if the provider remains unavailable', async () => {
    const fetch = mockProvider(response({}, 503));
    const result = await analyze(request({ description: 'rice', consent: true }));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: 'Photo AI is busy right now. Please try again shortly or search foods.' });
    expect(result.headers.get('Retry-After')).toBe('10');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(guestAiLimiter.release).toHaveBeenCalledOnce();
  });
});
