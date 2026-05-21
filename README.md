# Open WebUI Analytics (改進版)

一個專為 [Open WebUI](https://github.com/open-webui/open-webui) 設計的全面數據分析儀表板，提供 AI 助手使用情況、使用者參與度、模型效能與工具利用率的即時洞察。

本專案基於原作者的開源項目進行了深度改進與優化，在此特別感謝原作者提供的優秀基礎架構與視覺設計！

[![Analytics Dashboard](https://img.shields.io/badge/Analytics-Dashboard-blue)](#)
[![Database Support](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-green)](#)
[![Frontend](https://img.shields.io/badge/Frontend-Svelte-orange)](#)
[![Backend](https://img.shields.io/badge/Backend-Node.js-yellow)](#)

---

## 🌟 改進版獨家特點 (Improved Version Highlights)

相比於原始版本，此改進版針對實際管理與運維場景進行了以下深度優化：

1. **📊 資源導向的使用者排序 (Token-based Sorting)**
   * **改進**：將使用者分析頁面的預設排序，從原本單純的「對話次數」改為優先依據**「預估 Token 總消耗量 (Estimated Tokens)」**進行降序排序。
   * **管理優勢**：幫助管理員第一時間識別出資源消耗大戶，便於成本控制與額度分配。

2. **🏷️ 使用者模型分佈標籤 (User Model Usage Tags)**
   * **改進**：在每位使用者的統計卡片中，新增 **Models Used** 區塊。
   * **數據提取**：自動分析該使用者在所有歷史對話中呼叫過的所有 AI 模型及次數。
   * **精美 UI**：以高質感的 Badge 標籤展示，並配備精細滾動條，即使調用模型眾多也能保持版面整潔。

3. **🐳 穩健的 Docker 與 SQLite WAL 支援 (Robust SQLite WAL Fix)**
   * **改進**：修正了 Docker Compose 掛載機制。從掛載單一 `webui.db` 改為掛載其父目錄，使容器內的 SQLite 能正確讀取 WAL 模式產生的 `-wal` 和 `-shm` 日誌檔案。
   * **優勢**：徹底解決了 `database disk image is malformed` 的報錯，確保在高併發寫入時數據讀取的完整性與系統穩定性。

---

## ✨ 核心功能 (Core Features)

### 📊 數據統計與分析
- **使用者統計 (User Stats)**：總使用者數、活躍使用者數、參與度評級。
- **對話指標 (Chat Metrics)**：總對話量、隨時間變化的活動趨勢。
- **模型使用率 (Model Usage)**：追蹤各 AI 模型的熱門程度。
- **Token 消耗 (Token Consumption)**：估算的 Token 使用量與資源占比。
- **工具分析 (Tool Analytics)**：內建工具與自訂工具的呼叫頻次。

### 🎯 深度洞察
- 使用者參與模式與活躍時間熱點圖。
- 不同模型的效能與使用比例對比。
- 支援 7 天、30 天、90 天等多種時間跨度篩選。

### 🗄️ 多資料庫相容
- **SQLite**：直接連接 Open WebUI 本地資料庫。
- **PostgreSQL**：支援企業級資料庫。
- **自動偵測 (Auto-Discovery)**：自動尋找常見的資料庫路徑。

---

## 📋 系統要求 (Prerequisites)

- **Node.js** 18.0 或更高版本
- **npm** 或 **yarn** 包管理器
- 可存取的 **Open WebUI 資料庫**（SQLite 檔案或 PostgreSQL 連線資訊）

---

## 🚀 快速開始 (Quick Start)

### 1. 複製專案
```bash
git clone https://github.com/your-username/open-webui-analytics.git
cd open-webui-analytics
```

### 2. 安裝依賴
```bash
npm install
```

### 3. 啟動開發伺服器
```bash
npm run dev
```

開發模式啟動後：
- **前端介面 (Vite)**：http://localhost:5173
- **後端 API (Express)**：http://localhost:3001

---

## 🐳 Docker 部署 (Docker Compose)

針對改進版設計的推薦 `docker-compose.yml` 配置（已包含 SQLite WAL 相容性修復）：

```yaml
version: '3.8'

services:
  open-webui-analytics:
    build: .
    container_name: open-webui-analytics
    ports:
      - '3001:3001'
    volumes:
      # 掛載整個父目錄以支援 WAL 日誌檔案讀取
      - /home/ec2-user/openwebui:/app/data:ro
    environment:
      - DATABASE_URL=sqlite:////app/data/webui.db
      - PORT=3001
    restart: unless-stopped
```

啟動服務：
```bash
docker compose up -d --build
```

---

## 🔧 環境變數配置 (Environment Variables)

於專案根目錄建立 `.env` 檔案：

```env
# 資料庫配置 (SQLite 示例)
DATABASE_URL=sqlite:///path/to/webui.db

# PostgreSQL 示例
# DATABASE_URL=postgresql://user:password@host:port/database

# 服務埠口
PORT=3001
```

---

## 🏗️ 專案架構 (Architecture)

### 前端 (Svelte)
```
src/
├── components/           # 可重用 UI 組件
│   ├── Overview.svelte       # 儀表板總覽
│   ├── ModelUsage.svelte     # 模型分析
│   ├── ActivityChart.svelte  # 活動趨勢圖
│   ├── UserStats.svelte      # 改進版：使用者統計（支援 Token 排序與模型標籤）
│   ├── ToolUsage.svelte      # 工具分析
│   └── Setup.svelte          # 資料庫配置引導
├── lib/
│   └── api.js                # API 請求封裝
├── App.svelte            # 主應用入口
└── main.js               # 應用啟動腳本
```

### 後端 (Node.js)
```
server.js                 # Express 伺服器，負責資料庫抽象與 API 提供
```

---

## 🔌 API 端點 (API Endpoints)

- `GET /api/stats/overview` - 儀表板摘要統計
- `GET /api/stats/models` - 各模型使用率與 Token 佔比
- `GET /api/stats/activity?days=30` - 歷史活動趨勢
- `GET /api/stats/users` - 改進版：使用者詳細統計（含 Model 列表與 Token 排序）
- `GET /api/stats/tools` - 自訂/內建工具統計

---

## 🙏 致謝與聲明 (Acknowledgments)

* 特別感謝 **Open WebUI 團隊** 打造了如此強大且易用的 AI Web 介面。
* 本專案的基礎架構、API 設計與大部分前端視覺，均源於**原作者的開源項目**。感謝原作者的無私分享，為本分析儀表板奠定了穩固的基石。我們在此基礎上增添了更精細的使用者監控與系統穩定性改動，以回饋社區。

---

**Built with ❤️ for the Open WebUI community**