/**
 * @file 深度排查输入框背后所有图层.js
 * @description 获取输入框所在屏幕矩形区域内所有覆盖的 DOM 元素，彻底查清底部发暗的真正来源
 */

/**
 * 诊断输入框矩形区域内的所有层叠元素
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - CDP 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 异常时抛出错误
 */
async function inspectUnderlyingLayers(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const ts = await r.json();
    const t = ts.find(x => x.url && x.url.includes(targetUrl));
    if (!t) return console.log('未找到目标');

    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          // 获取输入框的屏幕坐标
          const composer = document.querySelector('[class*="_ComposerLayoutRoot_"]');
          if (!composer) return { error: '未找到 composer' };
          const rect = composer.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;

          // 使用 elementsFromPoint 探测此坐标下自上而下的所有图层
          const stack = document.elementsFromPoint(cx, cy);
          const results = [];
          stack.forEach((el, idx) => {
            const s = window.getComputedStyle(el);
            results.push({
              index: idx,
              tag: el.tagName,
              cls: el.className.substring(0, 80),
              bg: s.backgroundColor,
              bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.substring(0, 80) : 'none',
              filter: s.backdropFilter || s.webkitBackdropFilter || 'none',
              shadow: s.boxShadow !== 'none' ? s.boxShadow.substring(0, 50) : 'none',
              opacity: s.opacity
            });
          });

          // 另外检查 composer 所在父容器的所有兄弟节点
          let p = composer.parentElement;
          const siblings = [];
          while (p && p !== document.body) {
            Array.from(p.children).forEach(child => {
              if (child !== composer && !child.contains(composer)) {
                const s = window.getComputedStyle(child);
                const r = child.getBoundingClientRect();
                if (r.height > 0 && r.width > 0 && r.top + r.height > rect.top) {
                  siblings.push({
                    tag: child.tagName,
                    cls: child.className.substring(0, 80),
                    bg: s.backgroundColor,
                    bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.substring(0, 80) : 'none',
                    filter: s.backdropFilter || 'none',
                    top: Math.round(r.top),
                    h: Math.round(r.height)
                  });
                }
              }
            });
            p = p.parentElement;
          }

          return { stack: results, nearbySiblings: siblings };
        })()
      `;
      ws.send(JSON.stringify({ id: 4001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id === 4001) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error('排查失败:', err);
  }
}

inspectUnderlyingLayers();
