/**
 * @file 探查输入框结构.js
 * @description 检查 Codex 中 Composer (输入框及发送栏) 的真实 DOM 结构
 */

/**
 * 探查输入框结构
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectComposerStructure(targetUrl = 'app://-/index.html', port = 9335) {
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
          const textInput = document.querySelector('[contenteditable="true"], textarea, [class*="_Composer"]');
          return {
            footer: footer ? {
              tag: footer.tagName,
              className: footer.className,
              rect: footer.getBoundingClientRect()
            } : null,
            textInput: textInput ? {
              tag: textInput.tagName,
              className: textInput.className,
              rect: textInput.getBoundingClientRect()
            } : null
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 70, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 70) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectComposerStructure();
