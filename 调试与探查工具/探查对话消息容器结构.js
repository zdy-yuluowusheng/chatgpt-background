/**
 * @file 探查对话消息容器结构.js
 * @description 检查用户提问与 AI 回复在 Codex 中的具体容器层级与类名
 */

/**
 * 探查消息气泡容器
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectMessageBubbleContainers(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const userHeader = Array.from(document.querySelectorAll('h4')).find(h => h.textContent.includes('你说：'));
          const assistantHeader = Array.from(document.querySelectorAll('h4')).find(h => h.textContent.includes('ChatGPT 说：'));

          function getTurnContainer(h4) {
            if (!h4) return null;
            let p = h4.parentElement;
            const chain = [];
            for (let i = 0; i < 5; i++) {
              if (!p) break;
              chain.push({
                tag: p.tagName,
                className: p.className,
                attrs: Array.from(p.attributes).map(a => a.name + '=' + a.value.substring(0, 30))
              });
              p = p.parentElement;
            }
            return chain;
          }

          return {
            userTurn: getTurnContainer(userHeader),
            assistantTurn: getTurnContainer(assistantHeader)
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 60, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 60) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectMessageBubbleContainers();
