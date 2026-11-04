/**
 * @file 查找文档预览包装类与样式规则.mjs
 * @description 搜索出现 codex-docx-preview-wrapper 的所有地方（CSS规则、style元素或DOM节点）
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

  const findExpr = `
    (() => {
      const stylesWithKeyword = [];
      for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) {
        const text = style.textContent || '';
        if (text.includes('docx') || text.includes('preview')) {
          stylesWithKeyword.push({
            id: style.id,
            tag: style.tagName.toLowerCase(),
            snippet: text.substring(0, 300)
          });
        }
      }

      // 检查当前注入的全局透明主题 style
      const injectedTheme = document.getElementById('chatgpt-acrylic-theme-override') || 
                            document.getElementById('transparent-theme') ||
                            document.querySelector('style[id*="theme"]');

      return {
        stylesWithKeyword,
        injectedThemeId: injectedTheme ? injectedTheme.id : null,
        injectedThemeLength: injectedTheme ? injectedTheme.textContent.length : 0
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, findExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
