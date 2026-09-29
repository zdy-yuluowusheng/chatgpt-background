/**
 * @file 深入探查对话线程内容.js
 * @description 探查对话线程内部的各消息节点、选择器、文字内容及当前计算样式
 */

/**
 * 探查对话线程内部详情
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectConversationThread(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          let n;
          const matches = [];
          while (n = walker.nextNode()) {
            const val = (n.nodeValue || '').trim();
            if (val.length > 0 && (val.includes('npm') || val.includes('Bash') || val.includes('env') || val.includes('编辑') || val.includes('定位'))) {
              matches.push({ text: val, tag: n.parentElement.tagName, cls: n.parentElement.className });
            }
          }
          return matches;
        })()
      `;
      ws.send(JSON.stringify({ id: 40, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 40) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectConversationThread();
