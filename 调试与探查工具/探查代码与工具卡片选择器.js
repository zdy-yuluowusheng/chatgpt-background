/**
 * @file 探查代码与工具卡片选择器.js
 * @description 探查 Codex 中代码块、终端命令和工具操作卡片的精确选择器
 */

/**
 * 诊断代码块与工具卡片
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectCodeAndToolCards(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          // 查找页面上的 pre, code, terminal, elevated surface 等元素
          const candidates = document.querySelectorAll('pre, code, [class*="elevated"], [class*="surface-elevated"], [class*="code"], [class*="terminal"], [data-testid*="code"]');
          const results = [];
          for (const el of candidates) {
            const s = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            results.push({
              tag: el.tagName,
              cls: (typeof el.className === 'string' ? el.className : '').substring(0, 70),
              attrs: Array.from(el.attributes).filter(a => !['class', 'style'].includes(a.name)).map(a => a.name + '=' + a.value.substring(0, 30)),
              rect: { w: Math.round(r.width), h: Math.round(r.height) },
              bg: s.backgroundColor,
              textSnippet: (el.textContent || '').trim().substring(0, 40)
            });
          }
          return results.slice(0, 15);
        })()
      `;
      ws.send(JSON.stringify({ id: 201, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 201) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectCodeAndToolCards();
