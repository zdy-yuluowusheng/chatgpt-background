/**
 * @file 探查底部输入区背景.js
 * @description 检查输入框底部是否有渐变遮罩或伪元素遮挡壁纸
 */

/**
 * 诊断输入框底部区域背景
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectFooterBackground(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const footer = document.querySelector('[data-thread-scroll-footer]');
          if (!footer) return { error: '未找到 footer' };

          const fStyle = window.getComputedStyle(footer);
          const fBefore = window.getComputedStyle(footer, '::before');
          const fAfter = window.getComputedStyle(footer, '::after');

          const parent = footer.parentElement;
          const pStyle = parent ? window.getComputedStyle(parent) : null;

          return {
            footer: {
              className: footer.className,
              bg: fStyle.backgroundColor,
              bgImg: fStyle.backgroundImage,
              beforeBg: fBefore.backgroundImage !== 'none' ? fBefore.backgroundImage : fBefore.backgroundColor,
              afterBg: fAfter.backgroundImage !== 'none' ? fAfter.backgroundImage : fAfter.backgroundColor
            },
            parent: parent ? {
              className: parent.className,
              bg: pStyle.backgroundColor,
              bgImg: pStyle.backgroundImage
            } : null
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 401, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 401) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectFooterBackground();
