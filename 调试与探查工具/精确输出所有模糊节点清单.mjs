/**
 * @file 精确输出所有模糊节点清单.mjs
 * @description 仅提取并格式化打印当前页面上所有带有 backdropFilter 或 filter blur 的节点列表。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取所有模糊节点
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<Array<object>>} 模糊节点清单
 * @throws {Error} CDP 通信失败时抛出异常
 */
function getBlurredNodesOnly(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const blurredNodes = [];
          for (const el of document.querySelectorAll('*')) {
            if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
            const cs = window.getComputedStyle(el);
            const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
            const f = cs.filter || cs.webkitFilter || 'none';
            if ((bdf !== 'none' && bdf.includes('blur')) || (f !== 'none' && f.includes('blur'))) {
              const rect = el.getBoundingClientRect();
              blurredNodes.push({
                tag: el.tagName.toLowerCase(),
                className: String(el.className).substring(0, 80),
                id: el.id,
                bdf,
                f,
                bg: cs.backgroundColor,
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                text: (el.innerText || '').substring(0, 30).replace(/\\n/g, ' ')
              });
            }
          }
          return blurredNodes;
        })()
      `;

      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve(data.result?.result?.value);
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      ws.close();
      reject(err);
    };
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>} 无返回值
 */
async function main() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  const nodes = await getBlurredNodesOnly(page.webSocketDebuggerUrl);
  console.log(`共有 ${nodes.length} 个模糊节点:`);
  nodes.forEach((n, idx) => {
    console.log(`[${idx}] <${n.tag}> class="${n.className}" rect=(${n.rect.x},${n.rect.y},${n.rect.w},${n.rect.h}) bdf="${n.bdf}" f="${n.f}" text="${n.text}"`);
  });
}

main();
