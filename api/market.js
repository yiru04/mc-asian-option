// api/market.js — Vercel serverless function (CommonJS)
// Proxies Finnhub requests server-side to avoid browser CORS.

const FKEY = process.env.FINNHUB_KEY || "d10od91r01qlsacac3agd10od91r01qlsacac3b0";
const BASE  = "https://finnhub.io/api/v1";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { type, sym, res: resolution, from, to } = req.query;

  try {
    let url;

    if (type === "sofr") {
      url = `${BASE}/economic?code=SOFR&token=${FKEY}`;

    } else if (type === "candle") {
      if (!sym || !resolution || !from || !to) {
        return res.status(400).json({ error: "Missing: sym, res, from, to" });
      }
      if (sym.startsWith("OANDA:")) {
        url = `${BASE}/forex/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;
      } else if (sym.startsWith("BINANCE:")) {
        url = `${BASE}/crypto/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;
      } else {
        url = `${BASE}/stock/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;
      }

    } else {
      return res.status(400).json({ error: "Unknown type. Use: candle | sofr" });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      const txt = await upstream.text();
      return res.status(upstream.status).json({ error: `Finnhub ${upstream.status}: ${txt}` });
    }
    const data = await upstream.json();

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(data);

  } catch (err) {
    console.error("[market proxy]", err);
    return res.status(500).json({ error: err.message });
  }
};

