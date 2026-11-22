# Guessai 獨立服務規格（SPEC-05）

> 規格，已實作（GUE-01～05）。依據 `jp.6yuwei.com/docs/BLUEPRINT.md` §8.6。

Guessai 的後端原本寫在 `6yuwei_api` 裡（`routes/guessai_canvas.js`、`controllers/guessai_canvas.js`、`models/guessai_canvas.js`、`sockets/`），`6yuwei_api` 的 `identity-v2` 已刪除這些程式。現在搬到這個 repo 的 `server/`，成為獨立服務：

- 有自己的資料庫、檔案、密鑰和管理頁。
- 保留舊的訪客暱稱系統，但只留 Guessai 自己用得到的部分。
- 和 6yuwei 帳號、身分中心、`6yuwei_api` 都沒有任何關聯。

## 1. 部署

| 項目 | 內容 |
| --- | --- |
| 網址 | `https://guessai-canvas.6yuwei.com` |
| 容器 | 一個 Node 容器：建置時先 build 前端，執行時同一個 Express 提供前端靜態檔、`/api/guessai_canvas/*`、socket.io、`/admin` |
| 前端呼叫 | 同網域的 `/api`，socket.io 路徑 `/api/guessai_canvas/socket.io/`（`src/config.ts`） |
| 資料庫 | MongoDB `guessai_canvas`，專用帳號 `guessai_app` |
| 檔案 | 玩家頭像存在 volume `/data/uploads/img` |
| 反向代理 | 正式環境另外把 `https://api.6yuwei.com/guessai_canvas/handoff` 這一個路徑轉給這個容器，過渡期 90 天（§5） |

## 2. 訪客通行證

| 項目 | 規則 |
| --- | --- |
| cookie 名稱 | `guessai_canvas_access_token`（沿用） |
| 屬性 | HttpOnly、Secure、SameSite=Lax、Path=/、Max-Age 1 年 |
| 內容 | JWT（HS256），payload `{ userId }`，有效 1 年（沿用） |
| 簽章金鑰 | `GUESSAI_GUEST_SECRET`，值沿用舊 `6yuwei_api` 的 `SECRET_KEY`，所以舊通行證繼續有效 |
| 網域 | 新服務發的通行證屬於 `guessai-canvas.6yuwei.com`；舊的屬於 `api.6yuwei.com`，靠 §5 搬過來 |

## 3. 遊戲 API（前綴 `/api/guessai_canvas`）

只搬前端實際用到的端點，路徑、請求、回應都和現在相同，前端不用改。

| 方法和路徑 | 請求 | 回應 | 說明 |
| --- | --- | --- | --- |
| `POST /simple_user/` | multipart：`name`（必填）、`token`（reCAPTCHA v3）、`photo`（選填，5 MB 以下） | `{ message, id, name, photo, score }`，並設定通行證 | reCAPTCHA 分數低於 0.5 回 403；同一 IP 每天最多上傳 5 張圖 |
| `GET /simple_user/` | 通行證 | 玩家文件 `{ _id, name, photo, score, createdAt, updatedAt }` | 沒有或無效回 403 |
| `PUT /simple_user/` | 通行證；multipart：`photo` | `{ message: 'success', simpleUser }` | 換頭像，刪掉舊檔 |
| `GET /user_photo/:filename/` | — | 圖片 | 檔名只接受上傳時產生的格式 |
| `GET /msg_list/` | — | 最近 1000 則訊息（舊到新），`user` 展開成玩家 | 玩家已被刪除的訊息不列出（前端要顯示發言者） |
| `GET /canvas/` | — | 目前畫布的 HTML | CSP 見 §3.1 |
| `GET /canvas/:id/` | — | 指定畫布的 HTML | CSP 見 §3.1；找不到 404 |
| `GET /ranking/` | — | 分數最高的 30 位玩家 | |
| `GET /canvas_list/?page=&keyword=` | — | `{ canvasList, currentPage, solvedProbability, resultTotal, resultTotalPage, total }` | 每頁 12 筆，不含目前的畫布；答對的人已被刪除時，`correctRespondent` 是 `{ _id, name: '', photo: '' }`，畫廊仍顯示已解出 |

不搬的端點：`GET /`（Hello World）、`PUT /canvas/`（空函式）、`POST /theme/` 和 `GET /generate/`（改到管理頁）。

### 3.1 畫布頁的安全隔離

畫布是 AI 寫的 HTML 和程式碼，所以 `/canvas/` 和 `/canvas/:id/` 回應時加上：

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; sandbox allow-scripts
```

- `sandbox allow-scripts`（沒有 `allow-same-origin`）讓畫布頁變成獨立的來源，讀不到通行證 cookie，也碰不到遊戲頁面。
- `frame-ancestors` 只允許 `'self'`。

## 4. 即時通訊（socket.io）

| 項目 | 內容 |
| --- | --- |
| 路徑 | `/api/guessai_canvas/socket.io/` |
| 來源檢查 | 只接受 `https://guessai-canvas.6yuwei.com`（開發環境用自己的網址） |
| 身分 | 連線時從 cookie 讀通行證；沒有通行證可以收訊息，但不能發言 |

事件（沿用）：

| 方向 | 事件 | 內容 |
| --- | --- | --- |
| 前端 → 伺服器 | `client message` | 字串；同一玩家 3 分鐘最多 12 則 |
| 伺服器 → 前端 | `server message` | `{ user: { name, photo }, message, createdAt, isCorrect }` |
| 伺服器 → 前端 | `server canvas` | `{ status: 'loading' \| 'done' \| 'error', prevAnswer?, correctRespondent?, message? }` |
| 伺服器 → 前端 | `server ranking` | 前 30 名玩家 |

遊戲規則沿用：答對加 100 分、重新產生畫布；超過 4 分鐘且猜了 5 次以上沒人答對，就公布答案並換題。

和舊 API 不同的一點：Gemini 畫不出畫布時，伺服器送出 `server canvas` `{ status: 'error' }`，前端停止等待並提示玩家，下一則訊息會再試一次（舊 API 不通知，玩家畫面會一直停在載入中）。

## 5. 通行證搬移（過渡期 90 天）

舊通行證是 `api.6yuwei.com` 發的 cookie，只會送回 `api.6yuwei.com`。用下面的流程搬到 `guessai-canvas.6yuwei.com`。

### 5.1 流程

```
前端啟動
  └ GET /api/guessai_canvas/simple_user/
      ├ 200：已有新通行證，結束
      └ 403：
          ├ localStorage 有 guessai_handoff_done：顯示輸入暱稱的視窗，結束
          └ 沒有：寫入 guessai_handoff_done，整頁跳到
              <VITE_HANDOFF_URL>?return=<目前路徑>
              （正式 https://api.6yuwei.com/guessai_canvas/handoff；寫不進 localStorage 就不跳）

GET https://api.6yuwei.com/guessai_canvas/handoff（反向代理轉給本服務）
  ├ 讀 cookie guessai_canvas_access_token，用 GUESSAI_GUEST_SECRET 驗證，找到玩家
  │   ├ 成功：產生一次性代碼存進 handoff_codes（60 秒），舊 cookie 不清除（回退時還要用），
  │   │      302 到 https://guessai-canvas.6yuwei.com/api/guessai_canvas/handoff/complete?code=<代碼>&return=<路徑>
  │   └ 失敗：302 到 https://guessai-canvas.6yuwei.com<路徑>?handoff=none
  └（沒有 cookie 也走失敗）

GET /api/guessai_canvas/handoff/complete?code=&return=
  ├ 代碼存在且沒過期：刪除代碼（只能用一次），在本網域發新通行證，302 到 <路徑>
  └ 否則：302 到 <路徑>?handoff=none
```

### 5.2 規則

| 項目 | 規則 |
| --- | --- |
| `return` | 必須以 `/` 開頭、不能以 `//` 開頭，否則改用 `/` |
| 一次性代碼 | 32 bytes 隨機值，資料庫只存 SHA-256；60 秒 TTL；用過就刪 |
| 舊 cookie | 不清除。切換如果回退，舊系統還能用它認出玩家；它只會送到 `api.6yuwei.com`，搬移結束後沒有任何程式讀它，1 年內自然過期 |
| 每個瀏覽器最多跳一次 | 前端先寫 `localStorage` 標記再跳轉，不會無限跳 |
| 讀取的 cookie | handoff 只讀 `guessai_canvas_access_token`。瀏覽器也會帶上 `api.6yuwei.com` 的其他 cookie（例如 6yuwei 的 session），本服務一律不讀、不記錄 |
| 記錄 | 只記成功或失敗的次數，不記通行證內容 |
| 回來時 | 前端看到 `?handoff=none` 就從網址拿掉，並顯示輸入暱稱的視窗 |
| 前端設定 | 建置參數 `VITE_HANDOFF_URL`；空字串表示不搬移（本機開發、第 90 天之後） |
| 關閉 | `HANDOFF_ENABLED=false` 時兩個路徑都回 404 |
| 結束 | 第 90 天移除反向代理規則，`HANDOFF_ENABLED` 改成 `false`、`VITE_HANDOFF_URL` 設成空字串；下一個版本刪掉前後端的搬移程式（README「第 90 天」） |

### 5.3 反向代理

正式環境只轉 `api.6yuwei.com/guessai_canvas/handoff` 這一個路徑到本服務的 `/guessai_canvas/handoff`。`api.6yuwei.com` 上其他 `/guessai_canvas/*` 由 `6yuwei_api` 回 404。設定方式在 OPS-09 確認，寫進 `jp.6yuwei.com/docs/environments.md`，切換當天驗證。

## 6. 管理頁 `/admin`

伺服器直接產生的簡單頁面，不需要另外建置。

### 6.1 登入

| 項目 | 規則 |
| --- | --- |
| 帳號 | 只有一組管理員密碼，雜湊存在 `GUESSAI_ADMIN_PASSWORD_HASH`：scrypt，格式 `scrypt:N:r:p:salt:hash`，用 `server/scripts/hash-password.js` 產生。分隔用 `:` 不用 `$`，因為 compose 和 Coolify 會把 `$` 當成變數 |
| session | cookie `__Host-guessai_admin`（本機 http 開發時是 `guessai_admin`）：HttpOnly、Secure、SameSite=Strict；閒置 30 分鐘、最長 8 小時；存在 MongoDB `admin_sessions`，只存 cookie 值用 `GUESSAI_SESSION_SECRET` 算出的 HMAC |
| CSRF | 每個 POST 要從本站送出（`Origin` 必須是本站），登入以外的表單還要帶 session 綁定的 token |
| 限流 | 登入每個 IP 15 分鐘 10 次；密碼正確後重新計算 |
| 其他 | `noindex`、`Cache-Control: no-store`、CSP 只允許自己（沒有內嵌 script 和 style）；`Referrer-Policy: same-origin`，表單送出時瀏覽器才會帶 `Origin` |
| 沒設定 | 開發環境可以不設兩個值，`/admin` 回 503；正式環境沒設就不啟動 |

### 6.2 功能

| 頁面 | 功能 |
| --- | --- |
| 主題 | 列出；一次新增多筆（中、英、日三種語言）；刪除；重複的中文主題略過（沿用舊規則） |
| 畫布 | 列出（含答案、是否解出、答對的人）；預覽；刪除；「立即產生新畫布」（取代舊的 `GET /generate/`，已有未解畫布時提示） |
| 聊天 | 最近的訊息；刪除單則訊息 |
| 玩家 | 搜尋暱稱；改名；刪除玩家（連同頭像和這位玩家的聊天訊息）；把單一玩家的分數歸零 |
| 排行榜 | 全部分數歸零（要再輸入一次確認） |

管理頁的每個操作都記錄在 `admin_logs`（時間、動作、對象）。

## 7. 資料

資料庫 `guessai_canvas`：

| collection | 來源 | 說明 |
| --- | --- | --- |
| `simpleusers` | 從 `6yuwei` 搬 | 玩家 `{ name, photo, score }` |
| `messages` | 從 `6yuwei` 搬 | 聊天 `{ message, user, isCorrect }` |
| `guessaicanvas` | 從 `6yuwei` 搬 | 畫布 `{ canvas, answerTW, answerEN, answerJP, correctRespondent, solved }` |
| `themes` | 從 `6yuwei` 搬 | 主題 `{ themeTW, themeEN, themeJP }` |
| `handoff_codes` | 新 | 搬移用的一次性代碼，TTL 60 秒 |
| `admin_sessions` | 新 | 管理頁 session，TTL |
| `admin_logs` | 新 | 管理頁操作紀錄 |

搬移（MIG-05）時，collection 名稱以 `6yuwei` 資料庫裡實際的名稱為準（Mongoose 依 model 名稱自動命名），新服務的 model 明確指定同樣的名稱。玩家頭像從 `6yuwei_api` 的 `uploads/guessai_canvas/img` 複製到本服務的 volume。

切換當天用 `server/scripts/migrate.js` 執行，先加 `--dry-run` 看報告：

```sh
OLD_MONGODB_URI=<6yuwei，只需要讀取權限> MONGODB_URI=<guessai_canvas> \
  node scripts/migrate.js --photos <舊 API 的 uploads/guessai_canvas/img> --dry-run
```

- 四個 collection 原樣複製，`_id` 和所有欄位不變，舊通行證和彼此的參照都照常有效。
- 舊資料只讀不改，什麼都不刪。新資料庫已經有的文件、upload 資料夾已經有的頭像都不覆蓋，所以重跑結果相同。
- 報告列出每個 collection 的筆數；有沒複製到的文件時指令會失敗（結束碼 1）。頭像找不到檔案或檔名不正常的，列在 `missingFile`、`refused`，那些玩家顯示預設頭像。
- 頭像寫到 `UPLOAD_DIR`（預設 `/data/uploads/img`），所以要在同時掛著舊 API 上傳資料夾（唯讀）和本服務 volume 的容器裡執行。

## 8. 環境變數

| 名稱 | 說明 |
| --- | --- |
| `PORT` | 程式預設 3010；Dockerfile 設成 3000 |
| `MONGODB_URI` | `guessai_canvas` 的連線字串 |
| `GUESSAI_GUEST_SECRET` | 訪客通行證的簽章金鑰（值沿用舊 `SECRET_KEY`） |
| `GEMINI_API_KEY` | 產生畫布 |
| `GEMINI_MODEL` | 預設 `gemini-3.1-flash-lite-preview` |
| `RECAPTCHA_SECRET_KEY` | 建立暱稱時驗證 |
| `GUESSAI_ADMIN_PASSWORD_HASH` | 管理員密碼的 scrypt 雜湊；正式環境必填 |
| `GUESSAI_SESSION_SECRET` | 管理頁 session 的金鑰，至少 32 個字元；正式環境必填 |
| `PUBLIC_ORIGIN` | `https://guessai-canvas.6yuwei.com`，socket.io 來源檢查和搬移的導回網址 |
| `HANDOFF_ENABLED` | `true` 時開啟 §5 的搬移端點；第 90 天改成 `false` 再刪程式 |
| `TRUST_PROXY` | Coolify 前面有反向代理，設 `true` |
| `VITE_HANDOFF_URL`（建置參數） | 前端搬移要去的路徑，預設 `https://api.6yuwei.com/guessai_canvas/handoff` |
| `UPLOAD_DIR`、`STATIC_DIR` | Dockerfile 已設定，不用改 |

## 9. 測試

| 範圍 | 測試 |
| --- | --- |
| 遊戲 API | §3 每個端點的成功和失敗情況 |
| 通行證 | 用舊 `SECRET_KEY` 簽的通行證可以讀到玩家 |
| 畫布頁 | 回應帶 `sandbox allow-scripts` |
| socket.io | 有通行證能發言；沒有不能；頻率限制 |
| 搬移 | 有通行證、沒有通行證、通行證無效、代碼過期、代碼重用、`return` 指到外站 |
| 管理頁 | 沒登入進不去；密碼錯；CSRF token 錯；每個功能 |
