/**
 * @file 深度查找会话标题背景来源.js
 * @description 检测 (500, 60) 处会话标题栏的每个祖先节点与图层背景
 */

/**
 * 诊断标题栏背景来源
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectTitlebarBackgroundOrigin(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const els = document.elementsFromPoint(500, 60);
          return els.map(el => {
            const s = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              id: el.id,
              cls: (typeof el.className === 'string' ? el.className : '').substring(0, 60),
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              bg: s.backgroundColor,
              bgImg: s.backgroundImage,
              filter: s.backdropFilter || s.webkitBackdropFilter,
              shadow: s.boxShadow
            };
          });
        })()
      `;
      ws.send(JSON.stringify({ id: 911, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 911) {
        const val = d.result?.result?.value || [];
        console.log(`击穿点 (500, 60) 共经过 ${val.length} 层:`);
        for (const item of val) {
          console.log(`<${item.tag}> #${item.id} .${item.cls} rect=(${item.rect.x},${item.rect.y},${item.rect.w},${item.rect.h}) bg=${item.bg} filter=${item.filter} shadow=${item.shadow}`);
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectTitlebarBackgroundOrigin();
