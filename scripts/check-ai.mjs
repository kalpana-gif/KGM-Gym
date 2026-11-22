import { createServer, loadEnv } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

const file = loadEnv('development', process.cwd(), '');
const settings = { ...file, ...process.env };
const required = ['GEMINI_API_KEY', 'AI_MODEL'];
const missing = required.filter(key => !settings[key]?.trim());
console.log(JSON.stringify({ serverConfigured: missing.length === 0, missingSettings: missing, signInRequired: false }, null, 2));

if (!process.argv.includes('--live')) {
  console.log('Use --live to send the public test meal photo through the actual guest AI function. Optional: --image PATH --description TEXT.');
} else if (missing.length) {
  console.log('Live provider check skipped: Gemini settings are missing.');
  process.exitCode = 1;
} else {
  let server;
  try {
    const argument = flag => { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] : undefined; };
    const path = argument('--image') ?? 'tests/fixtures/rice-and-curry.jpg';
    const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[extname(path).toLowerCase()];
    if (!mime) throw new Error('Use a JPEG, PNG or WebP photo.');
    const photo = await readFile(path);
    if (photo.length > 2_000_000) throw new Error('Choose a test image smaller than 2 MB.');
    for (const key of required) process.env[key] = settings[key];
    server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
    const module = await server.ssrLoadModule('/netlify/functions/analyze-food.ts');
    const start = Date.now();
    const response = await module.default(new Request('http://localhost/api/analyze-food', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: true, description: argument('--description') ?? '', mime, base64: photo.toString('base64') }),
    }), { ip: '127.0.0.1' });
    const result = await response.json();
    console.log(JSON.stringify({
      livePhotoCheck: { status: response.status, elapsedMs: Date.now() - start, foodCount: result.foods?.length, error: result.error },
      scope: 'Actual guest AI function and photo input. No Supabase sign-in or diary writes.',
    }, null, 2));
    if (response.ok) {
      await mkdir('artifacts', { recursive: true });
      await writeFile('artifacts/ai-live-result.json', JSON.stringify(result, null, 2));
      console.log('Validated meal estimate saved to artifacts/ai-live-result.json.');
    } else process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ livePhotoCheck: { status: 'failed', error: error.name } }, null, 2));
    process.exitCode = 1;
  } finally { if (server) await server.close(); }
}
