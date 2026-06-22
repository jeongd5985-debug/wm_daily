export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(500).json({ error: 'Upstash not configured' });

  try {
    const { date, list } = req.query;

    // ?list=1 → 최근 저장 날짜 목록 반환
    if (list) {
      const r = await fetch(`${url}/zrange/wm_daily:index/+inf/-inf/BYSCORE/REV/LIMIT/0/30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) return res.status(200).json({ dates: [] });
      const data = await r.json();
      return res.status(200).json({ dates: (data.result || []).slice(0, 30) });
    }

    if (!date) return res.status(400).json({ error: 'date required' });

    const key = `wm_daily:${date}`;
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return res.status(404).json({ error: 'not found', date });
    const data = await r.json();

    if (!data.result) return res.status(404).json({ error: 'not found', date });

    const payload = JSON.parse(data.result);
    return res.status(200).json({ ok: true, date, payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
