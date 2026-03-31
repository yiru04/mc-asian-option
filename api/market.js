const FKEY = process.env.FINNHUB_KEY || "d10od91r01qlsacac3agd10od91r01qlsacac3b0";
const BASE = "https://finnhub.io/api/v1";

// Determine asset class from symbol
function assetClass(sym) {
  if (!sym) return "stock";
  const s = sym.toUpperCase();
  if (s.startsWith("BINANCE:") || s.startsWith("COINBASE:") || s.endsWith("USDT") || s.endsWith("USDC")) return "crypto";
  if (s.startsWith("OANDA:") || s.startsWith("FXCM:") || /^[A-Z]{6}$/.test(s.replace(":", ""))) return "forex";
  return "stock";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { type, sym, res: resolution, from, to } = req.query;

  try {
    let url;
    const cls = assetClass(sym);

    if (type === "sofr") {
      url = `${BASE}/economic?code=SOFR&token=${FKEY}`;

    } else if (type === "candle") {
      if (cls === "crypto") {
        url = `${BASE}/crypto/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;
      } else if (cls === "forex") {
        url = `${BASE}/forex/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;
      } else {
        url = `${BASE}/stock/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;
      }

    } else if (type === "quote") {
      if (cls === "crypto" || cls === "forex") {
        // Finnhub has no dedicated crypto/forex quote endpoint — use recent daily candle
        const now = Math.floor(Date.now() / 1000);
        const dayAgo = now - 86400 * 5;
        const endpoint = cls === "crypto" ? "crypto" : "forex";
        url = `${BASE}/${endpoint}/candle?symbol=${sym}&resolution=D&from=${dayAgo}&to=${now}&token=${FKEY}`;
      } else {
        url = `${BASE}/quote?symbol=${sym}&token=${FKEY}`;
      }

    } else {
      return res.status(400).json({ error: "bad type" });
    }

    const r = await fetch(url);
    const data = await r.json();

    // Normalise crypto/forex "quote" (returned as candle) to { c: latestClose }
    if (type === "quote" && (cls === "crypto" || cls === "forex")) {
      if (data && Array.isArray(data.c) && data.c.length > 0) {
        return res.status(200).json({ c: data.c[data.c.length - 1], t: data.t[data.t.length - 1] });
      }
      return res.status(200).json({ c: null });
    }

    res.status(200).json(data);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
