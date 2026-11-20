/*
 * Admin pages, rendered on the server (docs/server.md §6). No inline script or style: the CSP
 * allows only this site's own files. Every value from the database goes through escape().
 */

export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

const NAV = [
  ['/admin', '總覽'],
  ['/admin/themes', '主題'],
  ['/admin/canvases', '畫布'],
  ['/admin/messages', '聊天'],
  ['/admin/players', '玩家'],
  ['/admin/ranking', '排行榜'],
];

const dateTime = (value) => (value
  ? new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
  : '');

const page = ({
  title, body, csrfToken, current, notice,
}) => `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)} · Guessai 管理</title>
<link rel="stylesheet" href="/admin/assets/admin.css">
<script src="/admin/assets/admin.js" defer></script>
</head>
<body>
${csrfToken === undefined ? '' : `<header class="top">
  <strong class="brand">Guessai 管理</strong>
  <nav>${NAV.map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
  <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${escape(csrfToken)}"><button class="link">登出</button></form>
</header>`}
<main>
<h1>${escape(title)}</h1>
${notice ? `<p class="notice ${notice.kind}" role="status">${escape(notice.text)}</p>` : ''}
${body}
</main>
</body>
</html>`;

const csrfField = (token) => `<input type="hidden" name="_csrf" value="${escape(token)}">`;

const postButton = ({
  action, csrfToken, label, confirm, danger = false, fields = '',
}) => `<form method="post" action="${escape(action)}" class="inline"${confirm ? ` data-confirm="${escape(confirm)}"` : ''}>${csrfField(csrfToken)}${fields}<button${danger ? ' class="danger"' : ''}>${escape(label)}</button></form>`;

const pager = (base, { page: current, pages }, params = {}) => {
  if (pages <= 1) return '';
  const link = (number, label) => {
    const query = new URLSearchParams({ ...params, page: String(number) });
    return `<a href="${escape(`${base}?${query}`)}">${label}</a>`;
  };
  return `<nav class="pager">${current > 1 ? link(current - 1, '上一頁') : ''}<span>第 ${current} / ${pages} 頁</span>${current < pages ? link(current + 1, '下一頁') : ''}</nav>`;
};

const searchForm = (action, keyword, label) => `<form method="get" action="${action}" class="search">
<label>${label} <input type="search" name="q" value="${escape(keyword)}" maxlength="100"></label><button>搜尋</button>
</form>`;

export const loginPage = ({ notice } = {}) => page({
  title: '登入',
  notice,
  body: `<form method="post" action="/admin/login" class="stack narrow">
<label>管理員密碼 <input type="password" name="password" autocomplete="current-password" required autofocus></label>
<button>登入</button>
</form>`,
});

export const notConfiguredPage = () => page({
  title: '管理頁還沒設定',
  body: '<p>伺服器沒有設定 <code>GUESSAI_ADMIN_PASSWORD_HASH</code> 和 <code>GUESSAI_SESSION_SECRET</code>，所以管理頁關閉。</p>',
});

export const overviewPage = ({ csrfToken, notice, data }) => {
  const { latest } = data;
  let status = '還沒有畫布。';
  if (latest) {
    status = latest.solved
      ? `最新的畫布（${escape(latest.answerTW)}）已經結束，玩家下一次發言時會產生新的。`
      : `目前的畫布答案是「${escape(latest.answerTW)}」，還沒有人解出。`;
  }
  return page({
    title: '總覽',
    current: '/admin',
    csrfToken,
    notice,
    body: `<dl class="stats">
<div><dt>玩家</dt><dd>${data.players}</dd></div>
<div><dt>畫布</dt><dd>${data.canvases}</dd></div>
<div><dt>主題</dt><dd>${data.themes}</dd></div>
<div><dt>聊天訊息</dt><dd>${data.messages}</dd></div>
</dl>
<section>
<h2>畫布</h2>
<p>${status}</p>
${postButton({ action: '/admin/canvases/generate', csrfToken, label: '立即產生新畫布' })}
<p class="hint">產生需要大約半分鐘。目前的畫布還沒有人解出時，不會產生新的。</p>
</section>
<section>
<h2>最近的管理操作</h2>
${data.logs.length ? `<table><thead><tr><th>時間</th><th>動作</th><th>內容</th></tr></thead><tbody>
${data.logs.map((entry) => `<tr><td>${dateTime(entry.createdAt)}</td><td>${escape(entry.action)}</td><td>${escape([entry.target, entry.detail].filter(Boolean).join(' '))}</td></tr>`).join('\n')}
</tbody></table>` : '<p>還沒有紀錄。</p>'}
</section>`,
  });
};

export const themesPage = ({
  csrfToken, notice, list, keyword,
}) => page({
  title: '主題',
  current: '/admin/themes',
  csrfToken,
  notice,
  body: `<section>
<h2>新增主題</h2>
<form method="post" action="/admin/themes" class="stack">
${csrfField(csrfToken)}
<label>一行一個主題，依序寫中文、英文、日文，用逗號、Tab 或「|」隔開。中文已經存在的會略過。
<textarea name="themes" rows="6" required placeholder="蘋果, Apple, りんご"></textarea></label>
<button>新增</button>
</form>
</section>
<section>
<h2>全部主題（${list.total}）</h2>
${searchForm('/admin/themes', keyword, '找主題')}
<table><thead><tr><th>中文</th><th>英文</th><th>日文</th><th></th></tr></thead><tbody>
${list.items.map((theme) => `<tr><td>${escape(theme.themeTW)}</td><td>${escape(theme.themeEN)}</td><td>${escape(theme.themeJP)}</td>
<td>${postButton({
    action: `/admin/themes/${theme.id}/delete`, csrfToken, label: '刪除', danger: true, confirm: `刪除主題「${theme.themeTW}」？`,
  })}</td></tr>`).join('\n')}
</tbody></table>
${pager('/admin/themes', list, keyword ? { q: keyword } : {})}
</section>`,
});

export const canvasesPage = ({ csrfToken, notice, list }) => page({
  title: '畫布',
  current: '/admin/canvases',
  csrfToken,
  notice,
  body: `${postButton({ action: '/admin/canvases/generate', csrfToken, label: '立即產生新畫布' })}
<table><thead><tr><th>建立時間</th><th>答案</th><th>狀態</th><th>答對的人</th><th></th></tr></thead><tbody>
${list.items.map((canvas) => {
    let state = '進行中';
    if (canvas.solved) state = canvas.correctRespondent ? '已解出' : '沒人答對';
    return `<tr><td>${dateTime(canvas.createdAt)}</td>
<td>${escape(canvas.answerTW)} / ${escape(canvas.answerEN)} / ${escape(canvas.answerJP)}</td>
<td>${state}</td><td>${escape(canvas.correctRespondent?.name ?? '')}</td>
<td class="actions"><a href="/api/guessai_canvas/canvas/${canvas.id}/" target="_blank" rel="noopener">預覽</a>
${postButton({
    action: `/admin/canvases/${canvas.id}/delete`, csrfToken, label: '刪除', danger: true, confirm: `刪除答案是「${canvas.answerTW}」的畫布？`,
  })}</td></tr>`;
  }).join('\n')}
</tbody></table>
${pager('/admin/canvases', list)}`,
});

export const messagesPage = ({ csrfToken, notice, list }) => page({
  title: '聊天',
  current: '/admin/messages',
  csrfToken,
  notice,
  body: `<table><thead><tr><th>時間</th><th>玩家</th><th>訊息</th><th></th></tr></thead><tbody>
${list.items.map((message) => `<tr><td>${dateTime(message.createdAt)}</td><td>${escape(message.user?.name ?? '（已刪除）')}</td>
<td>${escape(message.message)}${message.isCorrect ? ' <span class="tag">答對</span>' : ''}</td>
<td>${postButton({
    action: `/admin/messages/${message.id}/delete`, csrfToken, label: '刪除', danger: true, confirm: '刪除這則訊息？',
  })}</td></tr>`).join('\n')}
</tbody></table>
${pager('/admin/messages', list)}`,
});

export const playersPage = ({
  csrfToken, notice, list, keyword,
}) => page({
  title: '玩家',
  current: '/admin/players',
  csrfToken,
  notice,
  body: `${searchForm('/admin/players', keyword, '找暱稱')}
<p class="hint">共 ${list.total} 位。刪除玩家會一起刪掉這位玩家的頭像和聊天訊息。</p>
<table><thead><tr><th>暱稱</th><th>分數</th><th>加入時間</th><th></th></tr></thead><tbody>
${list.items.map((player) => `<tr><td>
<form method="post" action="/admin/players/${player.id}/rename" class="inline">${csrfField(csrfToken)}
<input name="name" value="${escape(player.name)}" maxlength="50" required aria-label="暱稱"><button>改名</button></form></td>
<td>${player.score ?? 0}</td><td>${dateTime(player.createdAt)}</td>
<td class="actions">${postButton({
    action: `/admin/players/${player.id}/reset-score`, csrfToken, label: '分數歸零', confirm: `把「${player.name}」的分數歸零？`,
  })}
${postButton({
    action: `/admin/players/${player.id}/delete`, csrfToken, label: '刪除', danger: true, confirm: `刪除玩家「${player.name}」？這位玩家的頭像和訊息也會刪掉。`,
  })}</td></tr>`).join('\n')}
</tbody></table>
${pager('/admin/players', list, keyword ? { q: keyword } : {})}`,
});

export const RANKING_CONFIRM_WORD = '重設排行榜';

export const rankingPage = ({ csrfToken, notice }) => page({
  title: '排行榜',
  current: '/admin/ranking',
  csrfToken,
  notice,
  body: `<p>把所有玩家的分數歸零。這個動作不能復原。</p>
<form method="post" action="/admin/ranking/reset" class="stack narrow">
${csrfField(csrfToken)}
<label>請輸入「${RANKING_CONFIRM_WORD}」確認 <input name="confirm" required autocomplete="off"></label>
<button class="danger">全部分數歸零</button>
</form>`,
});

export const errorPage = ({ title, text, csrfToken }) => page({
  title, csrfToken, body: `<p>${escape(text)}</p><p><a href="/admin">回到總覽</a></p>`,
});
