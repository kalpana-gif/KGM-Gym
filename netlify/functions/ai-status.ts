import { aiConfigured, type AiContext } from '../lib/ai-config';
import { json } from '../lib/shared';

export default async (request: Request, context?: AiContext) => {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);
  // Report configuration only; never expose credentials or claim a live provider check.
  return json({ configured: aiConfigured(context?.aiSettings) });
};
