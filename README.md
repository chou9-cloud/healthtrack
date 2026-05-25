# HealthTrack — 智慧減重追蹤

手機與電腦都能用的減重追蹤 Web App，支援 AI 餐點辨識。

## 功能
- 📸 拍照上傳 → AI 分析熱量（Claude Vision）
- 💧 喝水記錄
- ⚖️ 體重記錄 + 趨勢圖
- 🏃 運動記錄
- 😴 睡眠時間
- 😊 心情指數
- 🎯 每日卡路里目標
- 🔔 餐點提醒（早中晚+消夜）

---

## 部署到 Vercel（推薦，免費）

### 方法 A：直接拖曳（最快，2分鐘完成）

1. 前往 [vercel.com](https://vercel.com) → 註冊/登入（可用 GitHub 帳號）
2. 點擊 **Add New → Project**
3. 選擇 **"Import from your local filesystem"** 或直接拖曳整個 `healthtrack` 資料夾
4. 點擊 **Deploy** → 等待約 30 秒
5. 完成！Vercel 會給你一個 `xxx.vercel.app` 的網址

### 方法 B：透過 GitHub（之後可自動更新）

1. 在 [github.com](https://github.com) 建立新 repo（例如 `healthtrack`）
2. 上傳本資料夾內所有檔案
3. 前往 [vercel.com](https://vercel.com) → **Add New → Project**
4. 選擇你的 GitHub repo → **Deploy**
5. 之後修改程式碼 push 到 GitHub，Vercel 自動重新部署

---

## 部署到 GitHub Pages（完全免費）

1. 在 GitHub 建立新 repo，名稱任意（例如 `healthtrack`）
2. 上傳所有檔案到 repo
3. 進入 repo **Settings → Pages**
4. Source 選擇 **Deploy from a branch → main / (root)**
5. 儲存後等 1–2 分鐘，網址為 `https://你的帳號.github.io/healthtrack/`

---

## 使用 AI 餐點分析

1. 前往 [console.anthropic.com](https://console.anthropic.com) 取得 API Key
2. 開啟 HealthTrack → 點擊「餐點」頁
3. 在上方輸入 API Key 並儲存
4. 拍照上傳即可分析（API Key 只存在你自己的瀏覽器，不會傳給第三方）

---

## 檔案結構

```
healthtrack/
├── index.html    # 主頁面
├── style.css     # 樣式
├── app.js        # 程式邏輯
├── vercel.json   # Vercel 設定
└── README.md     # 說明
```

## 本機測試

直接用瀏覽器開啟 `index.html` 即可（Safari/Chrome/Firefox 皆支援）。
