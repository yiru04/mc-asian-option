// market.js — Vercel serverless function
// Quote:   Finnhub (already working)
// History: Yahoo Finance v8 chart API (free, no key needed)

const FKEY = process.env.FINNHUB_KEY || "d10od91r01qlsacac3agd10od91r01qlsacac3b0";
const FINNHUB = "https://finnhub.io/api/v1";

// Map our internal symbols to Yahoo Finance symbols
const YAHOO_SYM = {
  "AAPL":             "AAPL",
  "SPY":              "SPY",
  "GLD":              "GLD",
  "NVDA":             "NVDA",
  "BINANCE:BTCUSDT":  "BTC-USD",
  "OANDA:EUR_USD":    "EURUSD=X",
};

// Map to Finnhub quote symbols (stocks use /quote, crypto/forex use candle workaround)
function assetClass(sym) {
  if (!sym) return "stock";
  const s = sym.toUpperCase();
  if (s.startsWith("BINANCE:") || s.startsWith("COINBASE:")) return "crypto";
  if (s.startsWith("OANDA:")   || s.startsWith("FXCM:"))    return "forex";
  return "stock";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const { type, sym, from, to } = req.query;

  try {

    // ── CANDLE: use Yahoo Finance chart API ─────────────────────────────────
    if (type === "candle") {
      const yahooSym = YAHOO_SYM[sym] || sym;

      // Yahoo expects period1/period2 as unix timestamps
      // Use 1mo interval — Yahoo returns monthly OHLCV bars natively
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}` +
                  `?interval=1mo&period1=${from}&period2=${to}&events=history`;

      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      if (!r.ok) {
        return res.status(200).json({ s: "no_data", error: `Yahoo HTTP ${r.status}` });
      }

      const data = await r.json();
      const chart = data?.chart?.result?.[0];

      if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]?.close) {
        return res.status(200).json({ s: "no_data" });
      }

      const timestamps = chart.timestamp;
      const closes     = chart.indicators.quote[0].close;

      // Filter out nulls (incomplete current month bar)
      const t = [], c = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null) {
          t.push(timestamps[i]);
          c.push(parseFloat(closes[i].toFixed(6)));
        }
      }

      return res.status(200).json({ s: "ok", t, c });
    }

    // ── QUOTE: Finnhub for stocks/ETFs; Yahoo for crypto/forex ─────────────
    if (type === "quote") {
      const cls = assetClass(sym);

      if (cls === "stock") {
        // Finnhub quote — already confirmed working
        const url = `${FINNHUB}/quote?symbol=${sym}&token=${FKEY}`;
        const r   = await fetch(url);
        const d   = await r.json();
        // c = current price, pc = previous close (fallback when market closed)
        const price = (d.c > 0) ? d.c : d.pc;
        return res.status(200).json({ c: price, pc: d.pc });
      }

      // Crypto / Forex: Yahoo Finance (no Finnhub access on free tier)
      const yahooSym = YAHOO_SYM[sym] || sym;
      const now      = Math.floor(Date.now() / 1000);
      const weekAgo  = now - 86400 * 7;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}` +
                  `?interval=1d&period1=${weekAgo}&period2=${now}`;

      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!r.ok) return res.status(200).json({ c: null });

      const data   = await r.json();
      const chart  = data?.chart?.result?.[0];
      const closes = chart?.indicators?.quote?.[0]?.close;
      if (!closes?.length) return res.status(200).json({ c: null });

      // Take most recent non-null close
      const last = [...closes].reverse().find(x => x != null);
      return res.status(200).json({ c: last ?? null });
    }

    // ── SOFR ────────────────────────────────────────────────────────────────
    if (type === "sofr") {
      const url = `${FINNHUB}/economic?code=SOFR&token=${FKEY}`;
      const r   = await fetch(url);
      const d   = await r.json();
      return res.status(200).json(d);
    }

    return res.status(400).json({ error: "bad type" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
