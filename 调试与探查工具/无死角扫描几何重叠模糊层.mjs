/**
 * @file 无死角扫描几何重叠模糊层.mjs
 * @description 遍历全页面所有元素，通过 getBoundingClientRect() 判定是否覆盖 (800, 400) 并检查 filter/backdropFilter
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

  const scanExpr = `
    (() => {
      const px = 800;
      const py = 400;
      const coveringElements = [];

      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.left <= px && r.right >= px && r.top <= py && r.bottom >= py) {
          const cs = window.getComputedStyle(el);
          const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
          const f = cs.filter || cs.webkitFilter || 'none';
          
          coveringElements.push({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            className: el.className,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            pointerEvents: cs.pointerEvents,
            bdf,
            filter: f,
            bg: cs.backgroundColor,
            opacity: cs.opacity,
            zIndex: cs.zIndex,
            hasBlur: (bdf !== 'none' && bdf.includes('blur')) || (f !== 'none' && f.includes('blur'))
          });
        }
      }

      return {
        totalCovering: coveringElements.length,
        withBlur: coveringElements.filter(e => e.hasBlur),
        allCoveringSummary: coveringElements.map(e => ({
          tag: e.tag,
          class: String(e.className).substring(0, 40),
          pe: e.pointerEvents,
          bdf: e.bdf,
          f: e.filter,
          bg: e.bg,
          hasBlur: e.hasBlur
        }))
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, scanExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
