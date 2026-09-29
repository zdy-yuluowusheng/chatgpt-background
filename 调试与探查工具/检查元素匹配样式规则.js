/**
 * @file 检查元素匹配样式规则.js
 * @description 检查隐藏对话框的 DIV 元素究竟被哪条 CSS 规则设置了 display: none
 */

/**
 * 诊断匹配的 CSS 规则
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectMatchedRules(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const composer = document.querySelector('form, [class*="composer"], [class*="_Composer"], textarea, [contenteditable="true"]');
          if (!composer) return { error: '未找到 composer' };
          const s = window.getComputedStyle(composer);
          const r = composer.getBoundingClientRect();
          return {
            tag: composer.tagName,
            className: composer.className,
            rect: { w: r.width, h: r.height, x: r.x, y: r.y },
            display: s.display,
            visibility: s.visibility,
            bg: s.backgroundColor,
            backdropFilter: s.backdropFilter || s.webkitBackdropFilter
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 30, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 30) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectMatchedRules();
