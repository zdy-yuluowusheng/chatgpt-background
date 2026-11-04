/**
 * @file 探查滚动容器.mjs
 * @description 探查包含目标报错文本的元素其所有祖先节点中的滚动容器信息，找出真实激活的滚动视口。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查滚动容器链
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 祖先滚动容器信息
 * @throws {Error} 通信失败时抛出异常
 */
function inspectScrollContainers(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          let target = null;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (walker.currentNode.textContent.includes('Illegal mix of collations')) {
              target = walker.currentNode.parentElement;
              break;
            }
          }
          if (!target) return { found: false };

          const ancestors = [];
          let cur = target;
          while (cur && cur !== document.documentElement) {
            const cs = window.getComputedStyle(cur);
            ancestors.push({
              tag: cur.tagName.toLowerCase(),
              className: cur.className ? String(cur.className).substring(0, 80) : '',
              scrollHeight: cur.scrollHeight,
              clientHeight: cur.clientHeight,
              scrollTop: cur.scrollTop,
              overflowY: cs.overflowY,
              isScrollable: cur.scrollHeight > cur.clientHeight
            });
            cur = cur.parentElement;
          }

          return {
            found: true,
            ancestors
          };
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
  const report = await inspectScrollContainers(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(report, null, 2));
}

main();
