/**
 * @file 读取官方Docx预览自带样式.mjs
 * @description 读取包含 .codex-docx-preview-wrapper 的原生 style 标签内容
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
      const styles = Array.from(document.querySelectorAll('style'));
      const targetStyle = styles.find(s => s.id !== '__chatgpt_codex_custom_theme_style__' && (s.textContent || '').includes('codex-docx-preview-wrapper'));
      return targetStyle ? targetStyle.textContent : null;
    })()
  `;

  const cssText = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, findExpr);
  console.log('官方 docx 预览自带样式:\n', cssText);
}

main().catch(console.error);
