# GuessAI Canvas
This is a game where AI generates canvas images, and players guess the content. 
Players can earn scores through guessing, and compete with each other through a leaderboard system.

這是一款由AI產生Canvas圖片，並由玩家猜測的遊戲。<br>
玩家可以透過猜測的方式，來獲得分數，玩家之間可以透過排行榜系統來競爭分數。

これはAIがCanvas画像を生成し、プレイヤーがその内容を推測するゲームです。
プレイヤーは推測を通じてスコアを獲得し、リーダーボードシステムを通じて互いに競争することができます。

## 架構（2026 年 11 月起）

Guessai 是獨立服務，不再依賴 `6yuwei_api`，也和 6yuwei 帳號無關。規格見 [docs/server.md](docs/server.md)。

| 部分 | 位置 |
| --- | --- |
| 前端（React + Vite） | 根目錄 `src/` |
| 遊戲伺服器（Express + socket.io + MongoDB） | `server/` |
| 管理頁 `/admin` | `server/src/admin/`，伺服器直接產生，不用另外建置 |
| 通行證搬移（過渡期） | `server/src/handoff.js`、`src/handoff.ts` |
| 部署 | 根目錄 `Dockerfile`、`compose.yaml`：一個容器提供前端、`/api/guessai_canvas/*`、socket.io 和 `/admin` |

## 本機開發

需要 Node 24 和本機 MongoDB。

```bash
# 伺服器
cd server && npm install && cp .env.example .env && npm run dev   # http://localhost:3010
# 前端（另一個終端機）
pnpm install && cp .env.example .env.local && pnpm dev             # http://localhost:5173，/api 轉給 3010
```

開發時要用管理頁，先在 `server/.env` 填 `GUESSAI_ADMIN_PASSWORD_HASH` 和 `GUESSAI_SESSION_SECRET`（見下面「管理頁」），再開 `http://localhost:3010/admin`。

建立暱稱要通過 reCAPTCHA，本機沒有 `RECAPTCHA_SECRET_KEY` 時會失敗；產生畫布要 `GEMINI_API_KEY`。

### 測試

```bash
cd server
npm test                                                     # 不連資料庫的部分
GUESSAI_TEST_MONGO_URL=mongodb://127.0.0.1:27017/ npm test   # 全部
```

連資料庫的測試只會用 `guessai_test`、`guessai_test_handoff`、`guessai_test_admin` 三個資料庫，開始和結束時都會刪掉它們，不管網址指向哪個資料庫。

前端：`pnpm lint`、`pnpm build`。

## 部署（Coolify）

用 `compose.yaml` 部署，容器內的連接埠是 3000，`/healthz` 是健康檢查。玩家頭像存在 volume `uploads`（容器裡的 `/data/uploads/img`），重新部署不會不見。

| 環境 | 網址 | 建置參數 `VITE_HANDOFF_URL` |
| --- | --- | --- |
| 正式 | `https://guessai-canvas.6yuwei.com` | 預設值 `https://api.6yuwei.com/guessai_canvas/handoff` |
| staging | `https://guessai-stg.6yuwei.com` | `https://api-stg.6yuwei.com/guessai_canvas/handoff` |

### 環境變數（執行時）

| 名稱 | 必填 | 說明 |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | 是 | 網站網址；socket.io 只接受這個來源，搬移完成後也導回這裡 |
| `MONGODB_URI` | 是 | 資料庫 `guessai_canvas`（staging：`guessai_canvas_stg`）的連線字串，用專用帳號 `guessai_app` |
| `GUESSAI_GUEST_SECRET` | 是 | 訪客通行證的簽章金鑰；值沿用舊 `6yuwei_api` 的 `SECRET_KEY`，舊通行證才會繼續有效。換掉的話所有玩家都要重新輸入暱稱 |
| `GUESSAI_ADMIN_PASSWORD_HASH` | 正式環境必填 | 管理員密碼的雜湊，見「管理頁」 |
| `GUESSAI_SESSION_SECRET` | 正式環境必填 | 管理頁 session 的金鑰，至少 32 個字元（`openssl rand -base64 32`）；換掉的話管理員要重新登入 |
| `HANDOFF_ENABLED` | | `true` 時開啟通行證搬移；compose 預設 `true`，第 90 天改成 `false` |
| `GEMINI_API_KEY` | | 產生畫布；沒有的話玩家會看到「畫布畫不出來」的提示 |
| `GEMINI_MODEL` | | 預設 `gemini-3.1-flash-lite-preview` |
| `RECAPTCHA_SECRET_KEY` | | 建立暱稱時驗證；reCAPTCHA 的網站設定要加入 staging 網域 |
| `TRUST_PROXY` | | Coolify 前面有反向代理，設 `true`（compose 已設定） |
| `PORT`、`UPLOAD_DIR`、`STATIC_DIR` | | Dockerfile 已設定，不用改 |

`NODE_ENV=production` 時，少了管理頁的兩個值，或值的格式不對，伺服器不會啟動。

### 建置參數（前端）

| 名稱 | 說明 |
| --- | --- |
| `VITE_API_URL` | Dockerfile 固定為 `/api`（同網域） |
| `VITE_HANDOFF_URL` | 沒有通行證的玩家第一次進來時要去的舊網域路徑；設成空字串就關閉 |

## 管理頁

網址是 `/admin`，只有一組管理員密碼。

1. 產生密碼雜湊（會要你輸入兩次密碼，畫面上不會顯示）：

   ```bash
   cd server && node scripts/hash-password.js
   ```

   密碼至少 12 個字元。輸出像 `scrypt:32768:8:1:...`，整串設成 `GUESSAI_ADMIN_PASSWORD_HASH`。容器裡也有這支程式：`node scripts/hash-password.js`。
2. 設定 `GUESSAI_SESSION_SECRET`，重新部署。
3. 開 `/admin` 登入。

| 頁面 | 能做的事 |
| --- | --- |
| 總覽 | 玩家、畫布、主題、訊息的數量；目前的畫布；立即產生新畫布；最近 20 筆管理操作 |
| 主題 | 一次貼上多筆（一行一筆：中文、英文、日文，用逗號、Tab 或「\|」隔開；中文重複的會略過）；搜尋；刪除 |
| 畫布 | 列出答案、狀態和答對的人；預覽；刪除；立即產生新畫布 |
| 聊天 | 最近的訊息；刪除單則 |
| 玩家 | 搜尋暱稱；改名；把一位玩家的分數歸零；刪除玩家（連同頭像和這位玩家的聊天訊息） |
| 排行榜 | 全部分數歸零，要輸入「重設排行榜」確認 |

安全設定：

- 登入後的 session 閒置 30 分鐘或滿 8 小時就失效。
- 同一個 IP 15 分鐘內最多試 10 次密碼，密碼正確後重新計算。
- 每個表單都要帶 session 的 CSRF token，而且要從本站送出（檢查 `Origin`）。
- 頁面不讓搜尋引擎收錄，也不快取。每個操作都記在 `admin_logs`。

## 通行證搬移（過渡期 90 天）

舊玩家的通行證是 `api.6yuwei.com` 發的 cookie，新網站讀不到。過渡期間這樣搬過來（詳見 [docs/server.md §5](docs/server.md)）：

1. 玩家打開新網站，沒有通行證時，前端在 `localStorage` 記下 `guessai_handoff_done`，然後跳到 `https://api.6yuwei.com/guessai_canvas/handoff`。每個瀏覽器最多跳一次。
2. 反向代理把這個路徑轉給本服務。本服務讀舊通行證，發一個 60 秒、只能用一次的代碼，再導回新網站的 `/api/guessai_canvas/handoff/complete`。
3. 新網站用代碼換一張新的通行證，玩家保留原本的暱稱和分數。沒有舊通行證的玩家會看到建立暱稱的視窗。

日誌只記成功和失敗的次數（`guessai_handoff`），不記通行證或代碼。

第 90 天（POST-04）：

1. 移除 `api.6yuwei.com/guessai_canvas/handoff` 的反向代理規則。
2. 把 `HANDOFF_ENABLED` 改成 `false`、`VITE_HANDOFF_URL` 設成空字串，重新部署。
3. 下一個版本刪掉 `server/src/handoff.js`、`src/handoff.ts` 和相關測試。
