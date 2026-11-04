/**
 * @file 全局搜索资源卡片场景.mjs
 * @description 搜索页面上所有匹配 group/resource-card 的元素及其父级容器，查看各自的用途与父级结构
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

  const searchExpr = `
    (() => {
      const cards = Array.from(document.querySelectorAll('[class*="group/resource-card"]'));
      return cards.map(c => {
        const p = c.parentElement;
        const csP = p ? window.getComputedStyle(p) : {};
        const csC = window.getComputedStyle(c);
        return {
          text: (c.innerText || '').substring(0, 30).replace(/\\n/g, ' '),
          parentTag: p ? p.tagName.toLowerCase() : '',
          parentClass: p ? p.className : '',
          parentBorder: csP.border,
          childBorder: csC.border
        };
      });
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, searchExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
