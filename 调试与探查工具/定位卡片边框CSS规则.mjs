/**
 * @file 定位卡片边框CSS规则.mjs
 * @description 探查给外层卡片和内层 group/resource-card 施加 border 和 background 的所有 CSS 规则
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

  const inspectRulesExpr = `
    (() => {
      const innerCard = document.querySelector('div.group\\\\/resource-card');
      const outerCard = innerCard ? innerCard.parentElement : null;

      if (!innerCard || !outerCard) {
        return { error: '未找到卡片' };
      }

      // 获取页面上所有匹配 innerCard 和 outerCard 的 CSS 规则
      const getMatchingRules = (el) => {
        const matched = [];
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule.selectorText) {
                try {
                  if (el.matches(rule.selectorText)) {
                    matched.push({
                      sheetId: sheet.ownerNode?.id || 'external/inline',
                      selector: rule.selectorText,
                      border: rule.style.border || rule.style.borderColor || rule.style.borderWidth,
                      bg: rule.style.background || rule.style.backgroundColor,
                      bdf: rule.style.backdropFilter,
                      cssText: rule.cssText.substring(0, 150)
                    });
                  }
                } catch (e) {
                  // selector matches error (e.g. unknown pseudo)
                }
              }
            }
          } catch (e) {}
        }
        return matched;
      };

      return {
        outer: {
          tag: outerCard.tagName.toLowerCase(),
          className: outerCard.className,
          matchedRules: getMatchingRules(outerCard)
        },
        inner: {
          tag: innerCard.tagName.toLowerCase(),
          className: innerCard.className,
          matchedRules: getMatchingRules(innerCard)
        }
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectRulesExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
