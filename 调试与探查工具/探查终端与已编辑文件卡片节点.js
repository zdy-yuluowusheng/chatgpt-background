/**
 * @file 探查终端与已编辑文件卡片节点.js
 * @description 寻找包含 "Bash" 和 "已编辑 3 个文件" 的节点，查看其所有层级背景和边框
 */

/**
 * 诊断终端与卡片节点
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectTerminalAndToolCards(targetUrl = 'app://-/index.html', port = 9335) {
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
          let bashNode = null;
          let editNode = null;
          while (n = walker.nextNode()) {
            const txt = (n.nodeValue || '').trim();
            if (txt === 'Bash') bashNode = n.parentElement;
            if (txt.includes('已编辑') && txt.includes('文件')) editNode = n.parentElement;
          }

          function getCardInfo(leaf) {
            if (!leaf) return null;
            let p = leaf;
            const chain = [];
            for (let i = 0; i < 7; i++) {
              if (!p || p === document.body) break;
              const s = window.getComputedStyle(p);
              const r = p.getBoundingClientRect();
              chain.push({
                tag: p.tagName,
                cls: (typeof p.className === 'string' ? p.className : '').substring(0, 60),
                rect: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
                bg: s.backgroundColor,
                border: s.border,
                borderRadius: s.borderRadius,
                filter: s.backdropFilter || s.webkitBackdropFilter
              });
              p = p.parentElement;
            }
            return chain;
          }

          return {
            bash: getCardInfo(bashNode),
            editFiles: getCardInfo(editNode)
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 801, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 801) {
        console.dir(d.result?.result?.value, { depth: null });
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectTerminalAndToolCards();
