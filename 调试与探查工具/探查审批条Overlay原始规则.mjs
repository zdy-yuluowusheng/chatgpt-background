/**
 * @file 探查审批条Overlay原始规则.mjs
 * @description 获取页面上所有匹配 popcorn-review-bar-overlay 的元素的样式与层叠定位
 * @author Antigravity
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在目标 WebSocket 上执行表达式
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} expr - JavaScript 表达式
 * @returns {Promise<any>} 执行结果
 * @throws {Error} 通信失败或超时
 */
function evaluateOnTarget(wsUrl, expr) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP evaluate 超时'));
    }, 8000);

    ws.onopen = () => {
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
  const targets = await res.json();
  const mainPage = targets.find(t => t.type === 'page' && t.url.includes('index.html'));

  const inspectExpr = `
    (() => {
      const els = Array.from(document.querySelectorAll('.popcorn-review-bar-overlay, .popcorn-review-bar-overlay-content, [class*="popcorn"]'));
      return els.map(el => {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          className: el.className,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          position: cs.position,
          zIndex: cs.zIndex,
          inset: \`\${cs.top} \${cs.right} \${cs.bottom} \${cs.left}\`,
          bdf: cs.backdropFilter,
          filter: cs.filter,
          bg: cs.backgroundColor,
          outerHTML: el.outerHTML.substring(0, 300)
        };
      });
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
