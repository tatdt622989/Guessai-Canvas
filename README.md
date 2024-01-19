# GuessAI Canvas
This is a game where AI generates canvas images, and players guess the content. 
Players can earn scores through guessing, and compete with each other through a leaderboard system.

這是一款由AI產生Canvas圖片，並由玩家猜測的遊戲。<br>
玩家可以透過猜測的方式，來獲得分數，玩家之間可以透過排行榜系統來競爭分數。

これはAIがCanvas画像を生成し、プレイヤーがその内容を推測するゲームです。
プレイヤーは推測を通じてスコアを獲得し、リーダーボードシステムを通じて互いに競争することができます。

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
