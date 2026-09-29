/**
 * @file 探查网页预览卡片.js
 * @description 寻找包含“网页预览”文本的节点并检查其祖先容器的样式
 */

/**
 * 诊断网页预览卡片的背景与层级结构
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 网络或通信失败时抛出错误
 */
async function inspectWebPreviewCard(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/list`);
    const ts = await r.json();
    const t = ts.find(x => x.url && x.url.includes(targetUrl));
    if (!t) return console.log('未找到目标');

    const ws = new WebSocket(t.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          let n, leaf;
          while (n = walker.nextNode()) {
            if ((n.nodeValue || '').includes('网页预览')) {
              leaf = n.parentElement;
              break;
            }
          }
          if (!leaf) return '未找到网页预览节点';
          let curr = leaf;
          const res = [];
          for (let i = 0; i < 4; i++) {
            if (!curr) break;
            const s = window.getComputedStyle(curr);
            res.push({ tag: curr.tagName, cls: curr.className, bg: s.backgroundColor });
            curr = curr.parentElement;
          }
          return res;
        })()
      `;
      ws.send(JSON.stringify({ id: 99, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id === 99) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error('诊断失败:', err);
  }
}

inspectWebPreviewCard();
