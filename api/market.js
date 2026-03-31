// market.js — Vercel serverless function
// Candle history: Yahoo Finance (free, no key)
// Quote:          Finnhub stocks/ETF + Yahoo Finance crypto/forex
// Risk-free rate: Yahoo Finance ^IRX (13-week T-bill yield)

const FKEY   = process.env.FINNHUB_KEY || "d10od91r01qlsacac3agd10od91r01qlsacac3b0";
const FINNHUB = "https://finnhub.io/api/v1";

const YAHOO_SYM = {
  "AAPL":            "AAPL",
  "SPY":             "SPY",
  "GLD":             "GLD",
  "NVDA":            "NVDA",
  "BINANCE:BTCUSDT": "BTC-USD",
  "OANDA:EUR_USD":   "EURUSD=X",
};

function assetClass(sym) {
  if (!sym) return "stock";
  const s = sym.toUpperCase();
  if (s.startsWith("BINANCE:") || s.startsWith("COINBASE:")) return "crypto";
  if (s.startsWith("OANDA:")   || s.startsWith("FXCM:"))    return "forex";
  return "stock";
}

async function yahooQuote(yahooSym) {
  const now     = Math.floor(Date.now() / 1000);
  const weekAgo = now - 86400 * 7;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}` +
              `?interval=1d&period1=${weekAgo}&period2=${now}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) return null;
  const data   = await r.json();
  const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  if (!closes?.length) return null;
  return [...closes].reverse().find(x => x != null) ?? null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { type, sym, from, to } = req.query;

  try {

    // ── CANDLE: Yahoo Finance monthly bars ───────────────────────────────────
    if (type === "candle") {
      const yahooSym = YAHOO_SYM[sym] || sym;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}` +
                  `?interval=1mo&period1=${from}&period2=${to}&events=history`;
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) return res.status(200).json({ s: "no_data", error: `Yahoo HTTP ${r.status}` });

      const data  = await r.json();
      const chart = data?.chart?.result?.[0];
      if (!chart?.timestamp || !chart?.indicators?.quote?.[0]?.close)
        return res.status(200).json({ s: "no_data" });

      const t = [], c = [];
      const timestamps = chart.timestamp;
      const closes     = chart.indicators.quote[0].close;
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          t.push(timestamps[i]);
          c.push(parseFloat(closes[i].toFixed(6)));
        }
      }
      return res.status(200).json({ s: "ok", t, c });
    }

    // ── QUOTE ────────────────────────────────────────────────────────────────
    if (type === "quote") {
      const cls = assetClass(sym);
      if (cls === "stock") {
        const r = await fetch(`${FINNHUB}/quote?symbol=${sym}&token=${FKEY}`);
        const d = await r.json();
        const price = (d.c > 0) ? d.c : d.pc;
        return res.status(200).json({ c: price, pc: d.pc });
      }
      // crypto / forex → Yahoo
      const price = await yahooQuote(YAHOO_SYM[sym] || sym);
      return res.status(200).json({ c: price });
    }

    // ── SOFR: use Yahoo ^IRX (13-week T-bill annualised yield, in %) ─────────
    if (type === "sofr") {
      const price = await yahooQuote("%5EIRX");   // ^IRX URL-encoded
      if (price != null) {
        // ^IRX is quoted as a percentage (e.g. 4.33), convert to decimal
        return res.status(200).json({ data: [{ value: price }] });
      }
      // Hard fallback if Yahoo also fails
      return res.status(200).json({ data: [{ value: 4.33 }] });
    }

    return res.status(400).json({ error: "bad type" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
