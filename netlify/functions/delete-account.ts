import { adminClient, authenticate, json, smallBody } from '../lib/shared';
export default async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const { user } = await authenticate(request);
    const body = await smallBody(request, 1024);
    if (body.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm account deletion.' }, 400);
    const admin = adminClient();
    // The client uses flat owner/UUID.jpg paths. Remove all objects before auth deletion.
    while (true) {
      const { data, error } = await admin.storage.from('meal-photos').list(user.id, { limit: 100 });
      if (error) throw error;
      if (!data?.length) break;
      const { error: removal } = await admin.storage.from('meal-photos').remove(data.map(o => `${user.id}/${o.name}`));
      if (removal) throw removal;
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  } catch { return json({ error: 'Account deletion could not finish. Your local data has not been cleared; retry after checking server configuration.' }, 503); }
};
