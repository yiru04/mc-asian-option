# Monte Carlo Asian Option Pricing

Live market data (Finnhub) · Girsanov's theorem · Risk-neutral pricing

## 部署步驟（5 分鐘）

### 1. 上傳到 GitHub

1. 去 [github.com](https://github.com) → 右上角 **+** → **New repository**
2. 名稱填 `mc-asian-option`，選 **Public**，按 **Create repository**
3. 把這整個資料夾的所有檔案上傳（drag & drop 到 GitHub 網頁即可）

資料夾結構應該是：
```
mc-asian-option/
├── api/
│   └── market.js       ← Vercel serverless proxy
├── public/
│   └── index.html      ← 主頁面
├── package.json
├── vercel.json
└── README.md
```

### 2. 部署到 Vercel

1. 去 [vercel.com](https://vercel.com) → 用 GitHub 帳號登入
2. 按 **Add New Project** → 選剛才建立的 `mc-asian-option` repo
3. **不需要改任何設定**，直接按 **Deploy**
4. 等 1 分鐘 → 得到網址 `https://mc-asian-option-xxx.vercel.app`

### 3. （可選）設定環境變數

Finnhub API key 已內建在程式碼中。如果想更安全地管理，可以：
- 在 Vercel dashboard → Settings → Environment Variables
- 新增 `FINNHUB_KEY` = 你的 key
- 程式碼會自動讀取

## 功能

- 📈 **Data tab**：36 個月月度收盤價圖、校準參數、log-return 分布
- 📐 **Theory tab**：完整 10 步 ℙ → ℚ 換測度推導 + ℙ vs ℚ 對照圖
- ⚙️ **Sim/Results tab**：Monte Carlo 模擬 + 定價結果

## 技術架構

```
Browser → /api/market (Vercel serverless) → Finnhub API
```

瀏覽器呼叫同域的 `/api/market`，由 Vercel serverless function 在後端
代理 Finnhub 請求，完全繞過瀏覽器 CORS 限制。

若 API 失敗（離線環境），自動 fallback 到內嵌的 Apr 2022 – Mar 2025 靜態資料。
