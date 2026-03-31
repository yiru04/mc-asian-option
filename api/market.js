// api/market.js — Vercel serverless function (CommonJS)
// Proxies Finnhub requests server-side to avoid browser CORS.

const FKEY = process.env.FINNHUB_KEY || "你的金鑰";
const BASE = "https://finnhub.io/api/v1";

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

    if (type === "sofr") {
      url = `${BASE}/economic?code=SOFR&token=${FKEY}`;

    } else if (type === "candle") {
      if (!sym || !resolution || !from || !to) {
        return res.status(400).json({ error: "Missing sym/res/from/to" });
      }
      url = `${BASE}/stock/candle?symbol=${encodeURIComponent(sym)}&resolution=${encodeURIComponent(resolution)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&token=${FKEY}`;

    } else if (type === "quote") {
      if (!sym) {
        return res.status(400).json({ error: "Missing sym" });
      }
      url = `${BASE}/quote?symbol=${encodeURIComponent(sym)}&token=${FKEY}`;

    } else {
      return res.status(400).json({ error: "Unsupported type" });
    }

    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
      return res.status(r.status).json(data);
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      error: "Server error",
      detail: err.message || String(err),
    });
  }
};
