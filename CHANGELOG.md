# 更新日誌 (CHANGELOG)

本專案的所有重要更新將記錄於此。

---

## [1.1.0] - 2026-05-21

### ✨ 新增功能 (Features)
- **新增使用者模型使用量分佈**：在使用者統計 (User Stats) 卡片中，新增「使用模型 (Models Used)」區塊，列出每位使用者呼叫過的所有 AI 模型及其調用次數（以精美 Badge 標籤展示）。

### ⚡ 優化 (Optimizations)
- **使用者排序機制改進**：將使用者統計頁面的預設排序，從「對話次數 (Chat Count)」改為「預估 Token 消耗量 (Estimated Tokens)」降序排序，方便管理員直接找出資源消耗大戶。

### 🐛 修復 (Bug Fixes)
- **修復 Docker 環境下 SQLite WAL 導致的資料庫毀損錯誤 (`database disk image is malformed`)**：
  - **原因分析**：原先的 `docker-compose.yml` 僅掛載單一 `webui.db` 檔案，當 Open WebUI 以 SQLite WAL 模式運行時，容器因缺乏同目錄下 `webui.db-wal` 與 `webui.db-shm` 檔案的讀寫權限，導致查詢時拋出資料庫損壞異常。
  - **解決方案**：修改磁碟卷掛載方式，改為掛載 Open WebUI 的整個資料夾 `/home/ec2-user/openwebui` 到容器的 `/app/data:ro`，並修正資料庫連接字串 `DATABASE_URL=sqlite:////app/data/webui.db`。此修復解決了 WAL 讀取問題，並恢復了所有儀表板的歷史統計數據。
