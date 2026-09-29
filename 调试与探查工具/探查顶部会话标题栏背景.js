/**
 * @file 探查顶部会话标题栏背景.js
 * @description 检查顶部会话标题栏（包含会话名称及操作按钮）各个层级的背景色与遮挡情况
 */

/**
 * 诊断会话标题栏各层级背景
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectTitlebarBackground(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          // 标题栏位置击穿检测：x: 500, y: 65
          const stack = document.elementsFromPoint(500, 65);
          return stack.map(el => {
            const s = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              id: el.id,
              cls: (typeof el.className === 'string' ? el.className : '').substring(0, 60),
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              bg: s.backgroundColor,
              bgImg: s.backgroundImage,
              backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
              border: s.border
            };
          }).filter(item => item.bg !== 'rgba(0, 0, 0, 0)' || item.bgImg !== 'none' || item.backdropFilter !== 'none');
        })()
      `;
      ws.send(JSON.stringify({ id: 501, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 501) {
        const list = d.result?.result?.value || [];
        console.log(`找到 ${list.length} 个非透明节点:`);
        for (const item of list) {
          console.log(`[${item.tag}] #${item.id} .${item.cls} rect=(${item.rect.x},${item.rect.y},${item.rect.w},${item.rect.h}) bg=${item.bg} filter=${item.backdropFilter} border=${item.border}`);
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectTitlebarBackground();
