/**
 * @file 探查对话区两层边框来源.js
 * @description 检查右侧对话区域究竟是哪两个节点被赋予了背景和边框
 */

/**
 * 诊断对话区两层边框的具体节点与样式
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectDoubleBoxElements(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const thread = document.querySelector('[class*="realtime-voice-thread"]');
          if (!thread) return { error: '未找到 thread' };

          // 寻找 thread 下所有带有非透明背景或边框或 backdrop-filter 的元素
          const allEls = thread.querySelectorAll('*');
          const boxedEls = [];
          for (const el of allEls) {
            const s = window.getComputedStyle(el);
            const hasBg = s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent';
            const hasBorder = s.borderWidth && s.borderWidth !== '0px' && s.borderColor !== 'transparent';
            const hasFilter = (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none');
            
            if (hasBg || hasFilter || (hasBorder && parseInt(s.borderWidth) > 0)) {
              const r = el.getBoundingClientRect();
              boxedEls.push({
                tag: el.tagName,
                cls: (typeof el.className === 'string' ? el.className : '').substring(0, 60),
                rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
                bg: s.backgroundColor,
                border: s.border,
                borderRadius: s.borderRadius,
                filter: s.backdropFilter || s.webkitBackdropFilter,
                textSnippet: (el.textContent || '').trim().substring(0, 30)
              });
            }
          }

          return boxedEls;
        })()
      `;
      ws.send(JSON.stringify({ id: 101, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 101) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectDoubleBoxElements();
