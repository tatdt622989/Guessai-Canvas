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
| 部署 | 根目錄 `Dockerfile`：一個容器同時提供前端、`/api/guessai_canvas/*` 和 socket.io |

### 本機開發

```bash
# 伺服器（需要本機 MongoDB）
cd server && npm install && cp .env.example .env && npm run dev   # http://localhost:3010
# 前端（另一個終端機）
pnpm install && pnpm dev                                           # http://localhost:5173，/api 轉給 3010
```

測試：

```bash
cd server
npm test                                                             # 不連資料庫的部分
GUESSAI_TEST_MONGO_URL=mongodb://127.0.0.1:27017/ npm test   # 全部；只會用並刪除 guessai_test 資料庫
```

### 環境變數（server）

| 名稱 | 說明 |
| --- | --- |
| `PUBLIC_ORIGIN` | 網站網址，例如 `https://guessai-canvas.6yuwei.com`；socket.io 只接受這個來源 |
| `MONGODB_URI` | 資料庫 `guessai_canvas` 的連線字串 |
| `GUESSAI_GUEST_SECRET` | 訪客通行證的簽章金鑰；值沿用舊 `6yuwei_api` 的 `SECRET_KEY`，玩家的舊通行證才會繼續有效 |
| `GEMINI_API_KEY` | 產生畫布 |
| `GEMINI_MODEL` | 選填，預設 `gemini-3.1-flash-lite-preview` |
| `RECAPTCHA_SECRET_KEY` | 建立暱稱時驗證 |
| `TRUST_PROXY` | 前面有反向代理時設 `true` |
| `UPLOAD_DIR` | 玩家頭像，容器裡是 volume `/data/uploads/img` |
| `PORT` | 容器裡是 3000 |

前端建置時 `VITE_API_URL=/api`（Dockerfile 已設定）。

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list


## Backend

express.js + socket.io + mongodb 詳情請看 [backend](https://github.com/tatdt622989/6yuwei_api)
