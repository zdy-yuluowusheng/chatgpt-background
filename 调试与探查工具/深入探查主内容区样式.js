/**
 * @file 深入探查主内容区样式.js
 * @description 检查 _MainContentFrame_ 及其子元素的精确 class、内联样式与匹配的 CSS 规则
 */

/**
 * 探查主内容区匹配规则与样式来源
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectMainContentStyles(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const frame = document.querySelector('[class*=\"_MainContentFrame_\"]');
          if (!frame) return { error: '未找到 _MainContentFrame_' };

          const results = [];
          for (let i = 0; i < frame.children.length; i++) {
            const child = frame.children[i];
            const s = window.getComputedStyle(child);
            const r = child.getBoundingClientRect();
            results.push({
              index: i,
              tag: child.tagName,
              className: child.className,
              display: s.display,
              opacity: s.opacity,
              visibility: s.visibility,
              rect: { w: r.width, h: r.height, x: r.x, y: r.y },
              innerHTMLSnippet: child.innerHTML.substring(0, 300)
            });
          }

          // 同样检查 frame 的同级兄弟元素
          const siblings = [];
          if (frame.parentElement) {
            for (let i = 0; i < frame.parentElement.children.length; i++) {
              const sib = frame.parentElement.children[i];
              const s = window.getComputedStyle(sib);
              const r = sib.getBoundingClientRect();
              siblings.push({
                index: i,
                tag: sib.tagName,
                className: sib.className,
                display: s.display,
                rect: { w: r.width, h: r.height, x: r.x, y: r.y }
              });
            }
          }

          return {
            frameRect: frame.getBoundingClientRect(),
            frameChildren: results,
            viewportChildren: siblings
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 20, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 20) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectMainContentStyles();
