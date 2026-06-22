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
    const { date, payload } = req.body;
    if (!date || !payload) return res.status(400).json({ error: 'date and payload required' });

    const key   = `wm_daily:${date}`;
    const value = JSON.stringify({ ...payload, savedAt: new Date().toISOString() });
    const EX    = 60 * 60 * 24 * 30; // 30일

    // Upstash pipeline — 한 번의 요청으로 SET + ZADD
    const pipeline = [
      ["SET", key, value, "EX", EX],
      ["ZADD", "wm_daily:index", parseInt(date), date]
    ];

    const r = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pipeline)
    });

    const text = await r.text();
    let result;
    try { result = JSON.parse(text); } catch(e) {
      throw new Error('Upstash 응답 파싱 실패: ' + text.slice(0, 120));
    }
    if (!r.ok) throw new Error('Upstash 오류: ' + text.slice(0, 120));

    return res.status(200).json({ ok: true, key, date });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
