export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'Upstash not configured' });

  try {
    const { date, payload } = req.body;          // date: "20260622", payload: { wm, comments }
    if (!date || !payload) return res.status(400).json({ error: 'date and payload required' });

    const key = `wm_daily:${date}`;
    const value = JSON.stringify({ ...payload, savedAt: new Date().toISOString() });

    // SET with 30-day expiry
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, ex: 60 * 60 * 24 * 30 })
    });
    if (!r.ok) throw new Error('Redis SET failed: ' + await r.text());

    // 날짜 목록도 관리 (최근 30일 목록용)
    await fetch(`${url}/zadd/wm_daily:index`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: [{ score: parseInt(date), member: date }] })
    });

    return res.status(200).json({ ok: true, key, date });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
