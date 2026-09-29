/**
 * @file 深入探查输入框层级与计算样式.js
 * @description 寻找 Composer 输入框节点及其所有父级，查看究竟是哪个容器带有背景色、模糊、或外层遮罩
 */

/**
 * 诊断输入框及其所有父级容器的样式
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - CDP 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 异常时抛出错误
 */
async function inspectComposerHierarchy(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const ts = await r.json();
    const t = ts.find(x => x.url && x.url.includes(targetUrl));
    if (!t) return console.log('未找到目标');

    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const textarea = document.querySelector('.ProseMirror, textarea, [contenteditable="true"]');
          if (!textarea) return { error: '未找到输入元素' };

          let curr = textarea;
          const chain = [];
          while (curr && curr !== document.body) {
            const s = window.getComputedStyle(curr);
            const rect = curr.getBoundingClientRect();
            chain.push({
              tag: curr.tagName,
              id: curr.id,
              cls: curr.className.substring(0, 100),
              bg: s.backgroundColor,
              bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.substring(0, 80) : 'none',
              filter: s.backdropFilter || s.webkitBackdropFilter || 'none',
              shadow: s.boxShadow !== 'none' ? s.boxShadow.substring(0, 80) : 'none',
              opacity: s.opacity,
              w: Math.round(rect.width),
              h: Math.round(rect.height),
              top: Math.round(rect.top),
              left: Math.round(rect.left)
            });
            curr = curr.parentElement;
          }
          return chain;
        })()
      `;
      ws.send(JSON.stringify({ id: 3002, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id === 3002) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error('探查执行失败:', err);
  }
}

inspectComposerHierarchy();
