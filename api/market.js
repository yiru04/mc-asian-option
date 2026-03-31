const FKEY = process.env.FINNHUB_KEY || "d10od91r01qlsacac3agd10od91r01qlsacac3b0";
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
      url = `${BASE}/stock/candle?symbol=${sym}&resolution=${resolution}&from=${from}&to=${to}&token=${FKEY}`;

    } else if (type === "quote") {
      url = `${BASE}/quote?symbol=${sym}&token=${FKEY}`;

    } else {
      return res.status(400).json({ error: "bad type" });
    }

    const r = await fetch(url);
    const data = await r.json();

    res.status(200).json(data);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
