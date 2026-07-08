import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  try {
    const { date, payload } = req.body;
    
    if (!date || !payload) {
      return res.status(400).json({ error: "Missing date or payload" });
    }
    
    await redis.set(`wm-${date}`, JSON.stringify(payload), { ex: 7 * 24 * 3600 });
    
    res.status(200).json({ ok: true, date: date });
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).json({ error: err.message });
  }
}
