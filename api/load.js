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

  const headers = { Authorization: `Bearer ${token}` };

  async function upstash(command) {
    // command: array like ["GET", "key"] or ["ZRANGE", ...]
    const r = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, { headers });
    const text = await r.text();
    try { return JSON.parse(text); }
    catch(e) { throw new Error('Upstash 파싱 실패: ' + text.slice(0, 120)); }
  }

  try {
    const { date, list } = req.query;

    // ?list=1 → 최근 날짜 목록
    if (list) {
      // ZRANGE key max min BYSCORE REV LIMIT 0 30
      const data = await upstash([
        'ZRANGE', 'wm_daily:index',
        '+inf', '-inf',
        'BYSCORE', 'REV',
        'LIMIT', '0', '30'
      ]);
      return res.status(200).json({ dates: data.result || [] });
    }

    if (!date) return res.status(400).json({ error: 'date required' });

    const data = await upstash(['GET', `wm_daily:${date}`]);
    if (!data.result) return res.status(404).json({ error: 'not found', date });

    const payload = JSON.parse(data.result);
    return res.status(200).json({ ok: true, date, payload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
