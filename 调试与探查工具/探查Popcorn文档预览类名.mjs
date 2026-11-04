/**
 * @file 探查Popcorn文档预览类名.mjs
 * @description 扫描当前页面以及历史 DOM 中所有包含 popcorn 或 annotation 或 preview 的类名与节点。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查 popcorn 相关元素
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<Array<object>>} 探测结果
 * @throws {Error} 通信失败时抛出异常
 */
function inspectPopcornElements(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const matched = [];
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const cls = String(el.className || '');
            if (cls.includes('popcorn') || cls.includes('annotation') || cls.includes('paged') || cls.includes('preview')) {
              const cs = window.getComputedStyle(el);
              matched.push({
                tag: el.tagName.toLowerCase(),
                className: cls.substring(0, 100),
                bg: cs.backgroundColor,
                backdropFilter: cs.backdropFilter,
                filter: cs.filter,
                rect: el.getBoundingClientRect()
              });
            }
          }
          return matched;
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
  const listEls = await inspectPopcornElements(page.webSocketDebuggerUrl);
  console.log(`检索到 ${listEls.length} 个元素:`);
  console.log(JSON.stringify(listEls.slice(0, 10), null, 2));
}

main();
