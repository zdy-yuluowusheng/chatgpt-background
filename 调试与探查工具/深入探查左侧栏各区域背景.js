/**
 * @file 深入探查左侧栏各区域背景.js
 * @description 检查左侧图标轨、列表区及底层容器的实际背景色与遮挡情况
 */

/**
 * 探查左侧各区域背景色
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectLeftRailBackgrounds(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const elementsAtPoint = [];
          // 取侧边栏几个典型位置进行深度击穿检测
          // 1. 图标轨区域 (x: 25, y: 150)
          // 2. 项目列表区域 (x: 180, y: 150)
          const testPoints = [
            { name: '图标轨', x: 25, y: 150 },
            { name: '项目列表', x: 180, y: 150 }
          ];

          const results = [];
          for (const pt of testPoints) {
            const stack = document.elementsFromPoint(pt.x, pt.y);
            results.push({
              point: pt,
              stack: stack.map(el => {
                const s = window.getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return {
                  tag: el.tagName,
                  id: el.id,
                  cls: (typeof el.className === 'string' ? el.className : '').substring(0, 40),
                  rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
                  bg: s.backgroundColor,
                  disp: s.display,
                  vis: s.visibility,
                  backdropFilter: s.backdropFilter || s.webkitBackdropFilter
                };
              })
            });
          }

          return results;
        })()
      `;
      ws.send(JSON.stringify({ id: 90, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 90) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectLeftRailBackgrounds();
