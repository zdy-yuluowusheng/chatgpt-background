/**
 * @file 探测所有非透明代码与操作组件.js
 * @description 遍历页面上所有代码块、命令行、操作卡片节点，列出其计算背景样式与类名
 */

/**
 * 探测页面上所有与代码、终端、卡片相关的非透明元素
 * 
 * @param {string} targetUrl - 目标页面 URL
 * @param {number} port - CDP 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 网络异常或 WebSocket 连接失败时抛出错误
 */
async function probeOpaqueCodeElements(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) {
      console.log('未找到目标页面');
      return;
    }

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const results = [];
          const candidates = document.querySelectorAll(
            'pre, code, [class*="CodeBlock"], [class*="_Surface_"], [class*="StickyActionBar"], [class*="bg-secondary"], [class*="bg-surface"], [data-summary-panel-variant]'
          );
          candidates.forEach(el => {
            const s = window.getComputedStyle(el);
            const bg = s.backgroundColor;
            const bgImg = s.backgroundImage;
            const isOpaque = (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || (bgImg && bgImg !== 'none');
            if (isOpaque) {
              results.push({
                tag: el.tagName,
                cls: el.className,
                bg,
                bgImg: bgImg.length > 60 ? bgImg.substring(0, 60) + '...' : bgImg,
                text: el.innerText ? el.innerText.substring(0, 30).replace(/\\n/g, ' ') : ''
              });
            }
          });
          return results;
        })()
      `;
      ws.send(JSON.stringify({ id: 2001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 2001) {
        console.log('找到非透明代码/卡片元素数量:', d.result?.result?.value?.length);
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error('探测执行失败:', err);
  }
}

probeOpaqueCodeElements();
