import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { writeFile } from 'node:fs/promises';
import { catalog } from './src/data/catalog.ts';
import { workoutFor } from './src/data/workouts.ts';
import { initialProfile } from './src/types.ts';
import { Readable } from 'node:stream';

function localAiFunctions(): Plugin {
  return {
    name: 'kgm-fit-local-ai',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        const name = path === '/api/analyze-food' ? 'analyze-food' : path === '/api/ai-status' ? 'ai-status' : null;
        if (!name) return next();
        try {
          // Read current server settings per request without copying .env into
          // process.env, where it would survive Vite's in-process restarts.
          const env = loadEnv(server.config.mode, server.config.envDir, '');
          const aiSettings = { GEMINI_API_KEY: env.GEMINI_API_KEY, AI_MODEL: env.AI_MODEL };
          const module = await server.ssrLoadModule(`/netlify/functions/${name}.ts`);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
          }
          const options = { method: req.method, headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? {
            body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: 'half',
          } : {}) };
          const response: Response = await module.default(new Request(`http://localhost${req.url}`, options), { ip: req.socket.remoteAddress, aiSettings });
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Photo AI is unavailable. You can still search foods.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localAiFunctions(), {
    name: 'lankafit-catalog-seed',
    async writeBundle() {
      const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
      let sql = catalog.map(food => `insert into public.foods(id,name,payload) values(${quote(food.id)},${quote(food.name)},${quote(JSON.stringify(food))}::jsonb) on conflict(id) do update set name=excluded.name,payload=excluded.payload;\n` +
        [food.name,...food.aliases].map(alias => `insert into public.food_aliases(alias,food_id) values(${quote(alias.toLowerCase())},${quote(food.id)}) on conflict do nothing;`).join('\n')).join('\n');
      const exercises = new Map<string, unknown>();
      for (const equipment of ['none', 'bands', 'gym'] as const) {
        const week = Array.from({ length: 7 }, (_, day) => workoutFor(day, { ...initialProfile, equipment }));
        for (const day of week) for (const exercise of day.exercises) exercises.set(exercise.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), exercise);
        const id = `beginner-${equipment}`;
        sql += `\ninsert into public.workout_plans(id,payload) values(${quote(id)},${quote(JSON.stringify({ equipment, week }))}::jsonb) on conflict(id) do update set payload=excluded.payload;`;
      }
      for (const [id, exercise] of exercises) sql += `\ninsert into public.exercises(id,payload) values(${quote(id)},${quote(JSON.stringify(exercise))}::jsonb) on conflict(id) do update set payload=excluded.payload;`;
      await writeFile('supabase/seed.sql',`-- Generated from the offline catalog during npm run build.\n${sql}\n`);
    },
  }],
  server: { port: 5173 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0]);
