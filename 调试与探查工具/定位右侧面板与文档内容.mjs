/**
 * @file 定位右侧面板与文档内容.mjs
 * @description 寻找包含 docx 预览内容的 DOM 节点或隐藏的 iframe/webview，打印窗口尺寸与 DOM 树右侧分支
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
      const w = window.innerWidth;
      const h = window.innerHeight;

      // 找到所有带有 textContent 包含 "符合性" 或 "测试用例" 或 "报告" 或 "评审" 的元素
      const matchText = [];
      for (const el of document.querySelectorAll('*')) {
        if (el.children.length === 0 && (el.innerText || '').trim().length > 0) {
          const t = el.innerText.trim();
          if (t.includes('符合性') || t.includes('评审') || t.includes('测试报告')) {
            const r = el.getBoundingClientRect();
            matchText.push({
              tag: el.tagName.toLowerCase(),
              className: String(el.className).substring(0, 50),
              text: t.substring(0, 40),
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              parentClass: el.parentElement ? String(el.parentElement.className).substring(0, 50) : ''
            });
          }
        }
      }

      // 找到所有 position: fixed / absolute 且占据右半边的元素
      const rightOverlays = [];
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 300 && r.height > 300 && r.x >= w * 0.4) {
          const cs = window.getComputedStyle(el);
          rightOverlays.push({
            tag: el.tagName.toLowerCase(),
            className: String(el.className).substring(0, 60),
            id: el.id,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            bg: cs.backgroundColor,
            bdf: cs.backdropFilter,
            filter: cs.filter,
            overflow: cs.overflow,
            childCount: el.children.length
          });
        }
      }

      // 检查 #root 或 document.body 的直接大容器
      const bodyChildren = Array.from(document.body.children).map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: String(el.className).substring(0, 60),
          id: el.id,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        };
      });

      return {
        windowSize: { w, h },
        matchText,
        rightOverlays,
        bodyChildren
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
