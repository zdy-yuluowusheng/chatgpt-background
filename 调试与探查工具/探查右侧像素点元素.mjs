/**
 * @file 探查右侧像素点元素.mjs
 * @description 使用 document.elementFromPoint(x, y) 探查右侧模糊区域正中央的具体命中元素及其所有祖先层级和样式。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查指定坐标位置的命中元素链
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @param {number} x - 屏幕水平像素坐标
 * @param {number} y - 屏幕垂直像素坐标
 * @returns {Promise<object>} 命中元素信息
 * @throws {Error} 通信失败时抛出异常
 */
function inspectPointElement(wsUrl, x, y) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const el = document.elementFromPoint(${x}, ${y});
          if (!el) return { error: '未命中任何元素' };

          const elementsAtPoint = document.elementsFromPoint(${x}, ${y});

          const serialize = (node) => {
            const cs = window.getComputedStyle(node);
            return {
              tag: node.tagName.toLowerCase(),
              className: node.className,
              id: node.id,
              dataset: { ...node.dataset },
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              filter: cs.filter,
              backdropFilter: cs.backdropFilter,
              webkitBackdropFilter: cs.webkitBackdropFilter,
              opacity: cs.opacity,
              boxShadow: cs.boxShadow,
              border: cs.border,
              rect: node.getBoundingClientRect()
            };
          };

          const ancestors = [];
          let cur = el;
          while (cur && cur !== document.documentElement) {
            ancestors.push(serialize(cur));
            cur = cur.parentElement;
          }

          return {
            target: serialize(el),
            allAtPoint: elementsAtPoint.map(serialize),
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
  console.log(`探查窗口: ${page.title}`);
  // 探查右侧区域中央 (x: 800, y: 400)
  const detail = await inspectPointElement(page.webSocketDebuggerUrl, 800, 400);
  console.log(JSON.stringify(detail, null, 2));
}

main();
