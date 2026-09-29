/**
 * @file 深入查找Bash头部背景来源.js
 * @description 寻找包含 "Bash" 的节点，查看为什么它的头部依然带有深色背景
 */

/**
 * 诊断 Bash 头部背景
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectBashHeaderBackground(targetUrl = 'app://-/index.html', port = 9335) {
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
          let bashLeaf = null;
          while (n = walker.nextNode()) {
            if ((n.nodeValue || '').trim() === 'Bash') {
              bashLeaf = n.parentElement;
              break;
            }
          }
          if (!bashLeaf) return { error: '未找到 Bash 文本节点' };

          let curr = bashLeaf;
          const chain = [];
          for (let i = 0; i < 5; i++) {
            if (!curr) break;
            const s = window.getComputedStyle(curr);
            chain.push({
              tag: curr.tagName,
              cls: curr.className,
              bg: s.backgroundColor,
              bgImg: s.backgroundImage
            });
            curr = curr.parentElement;
          }

          return { chain };
        })()
      `;
      ws.send(JSON.stringify({ id: 1501, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1501) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectBashHeaderBackground();
