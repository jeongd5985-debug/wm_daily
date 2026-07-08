import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.query.list === "1") {
      const keys = await redis.keys("wm-*");
      const dates = keys.map(k => k.substring(3)).sort().reverse();
      return res.status(200).json({ dates: dates });
    }
    
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }
    
    const data = await redis.get(`wm-${date}`);
    
    if (!data) {
      return res.status(404).json({ error: "Data not found" });
    }
    
    res.status(200).json({ payload: JSON.parse(data) });
  } catch (err) {
    console.error("Load error:", err);
    res.status(500).json({ error: err.message });
  }
}
