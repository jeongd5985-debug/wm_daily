export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const { scope } = (req.body || {});
    const target = scope === 'kr'
      ? '한국(KRX) 상장 ETF 상위 20개 (NAV/순자산총액 큰 순)'
      : '글로벌 ETF 상위 20개 (AUM 큰 순)';

    const prompt = `tradingview.com/markets/etfs/ 또는 동등한 신뢰 출처(ETF.com, Yahoo Finance, KRX 등)에서 ${target}을 조회해서, 아래 JSON 형식만 반환해줘. 마크다운/코드블록/설명 없이 순수 JSON 배열만:
[
  {"symbol":"SPY","name":"SPDR S&P 500 ETF","price":545.21,"change_pct":-0.41,"volume":"45.2M","aum":"500B","category":"US Equity","currency":"USD"}
]

필드 규칙:
- symbol: 거래 티커
- name: 상품명 (간결하게)
- price: 종가 (숫자, 통화 단위는 currency로 표시)
- change_pct: 당일 변동률 (%, 숫자, 소수 둘째 자리)
- volume: 당일 거래량 (사람이 읽기 좋게 K/M/B)
- aum: 운용자산총액 (B = USD billion 또는 한국이면 억원)
- category: 자산군 (US Equity / Bond / Gold / Emerging / Tech / Korea Equity 등)
- currency: USD / KRW

수치는 web_search로 확인. 알 수 없는 값은 null. 정확히 20개. 추가 설명·머리말 금지, 첫 글자는 반드시 [ 로 시작.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText.slice(0, 300) });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    // JSON 배열 추출 — Claude가 부가 텍스트를 붙여도 [..] 블록만 파싱
    let etfs;
    try {
      const m = text.match(/\[[\s\S]*\]/);
      etfs = JSON.parse(m ? m[0] : text);
    } catch (e) {
      return res.status(500).json({ error: 'JSON parse 실패', raw: text.slice(0, 500) });
    }

    return res.status(200).json({
      etfs,
      scope: scope || 'global',
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
