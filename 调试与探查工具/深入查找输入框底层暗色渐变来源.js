/**
 * @file 深入查找输入框底层暗色渐变来源.js
 * @description 检查 (600, 780) 处的所有层级，找出产生暗紫色/黑色底色的具体节点
 */

/**
 * 诊断输入框底部暗色来源
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectBottomDarkGradient(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const all = document.querySelectorAll('*');
          const gradientEl = Array.from(all).find(d => {
            return (typeof d.className === 'string') && d.className.includes('-top-8') && d.className.includes('inset-x-0');
          });
          return gradientEl ? {
            tag: gradientEl.tagName,
            fullCls: gradientEl.className,
            parentTag: gradientEl.parentElement.tagName,
            parentCls: gradientEl.parentElement.className
          } : null;
        })()
      `;
      ws.send(JSON.stringify({ id: 1201, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1201) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectBottomDarkGradient();
