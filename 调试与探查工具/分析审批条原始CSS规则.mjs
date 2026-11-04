/**
 * @file 分析审批条原始CSS规则.mjs
 * @description 查看 popcorn-review-bar-overlay 的原生匹配 CSS 规则
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
      const el = document.querySelector('.popcorn-review-bar-overlay');
      if (!el) return { error: '未找到 overlay' };

      // 遍历所有 styleSheet 查找匹配 .popcorn-review-bar-overlay 的非自定义主题规则
      const matchedRules = [];
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.ownerNode?.id === '__chatgpt_codex_custom_theme_style__') continue;
          for (const rule of sheet.cssRules || []) {
            if (rule.selectorText && rule.selectorText.includes('popcorn-review-bar')) {
              matchedRules.push({
                selector: rule.selectorText,
                cssText: rule.cssText
              });
            }
          }
        } catch (e) {
          // ignore CORS
        }
      }

      return {
        matchedRules,
        outerHTML: el.outerHTML
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
