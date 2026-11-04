/**
 * @file 手术刀定位模糊层.mjs
 * @description 使用 document.elementsFromPoint(800, 400) 提取右侧模糊核心区域所有堆叠元素与祖先链路，全面诊断 computedStyle
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
      // 在屏幕中心偏右 (x: 800, y: 400) 采样堆叠元素
      const els = document.elementsFromPoint(800, 400);

      const stackInfo = els.map((el, i) => {
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          depth: i,
          tag: el.tagName.toLowerCase(),
          id: el.id,
          className: el.className,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          filter: cs.filter,
          bdf: cs.backdropFilter || cs.webkitBackdropFilter,
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          zIndex: cs.zIndex,
          position: cs.position,
          hasText: (el.innerText || '').substring(0, 40).replace(/\\n/g, ' ')
        };
      });

      // 针对最底部的正文或者最顶部的元素，追溯其所有祖先节点直到 html
      const topEl = els[0];
      const ancestors = [];
      let cur = topEl;
      while (cur && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur);
        if (cs.filter !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none') || cs.opacity !== '1') {
          ancestors.push({
            tag: cur.tagName.toLowerCase(),
            className: cur.className,
            filter: cs.filter,
            bdf: cs.backdropFilter,
            opacity: cs.opacity
          });
        }
        cur = cur.parentElement;
      }

      return {
        stackCount: els.length,
        stackInfo,
        suspiciousAncestors: ancestors
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
