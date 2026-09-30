/**
 * @file 探查ShadowDOM内样式表.mjs
 * @description 检查 Shadow DOM 内部所有的 style 标签和 adoptedStyleSheets 中的 CSS 变量与规则。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取主页面 WebSocket 调试 URL
 * 
 * @param {number} port - CDP 端口
 * @returns {Promise<string|null>} WebSocket URL
 * @throws {void} 捕获异常
 */
async function getMainPageWsUrl(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html') && !t.url.includes('initialRoute'));
    return page ? page.webSocketDebuggerUrl : null;
  } catch {
    return null;
  }
}

/**
 * 探查 ShadowRoot 内的样式与变量
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 结果
 * @throws {Error} 异常
 */
function inspectShadowStyles(wsUrl) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('超时'));
      }, 8000);

      ws.onopen = () => {
        const expression = `
          (() => {
            function getRootStyles(el) {
              if (!el || !el.shadowRoot) return null;
              const sr = el.shadowRoot;
              const styles = [];
              sr.querySelectorAll('style').forEach(s => {
                styles.push(s.textContent.slice(0, 1000));
              });

              const adopted = [];
              if (sr.adoptedStyleSheets) {
                for (const sheet of sr.adoptedStyleSheets) {
                  const rules = [];
                  try {
                    for (const r of sheet.cssRules) {
                      if (r.cssText.includes('background') || r.cssText.includes('--')) {
                        rules.push(r.cssText.slice(0, 200));
                      }
                      if (rules.length > 20) break;
                    }
                  } catch (e) {}
                  adopted.push(rules);
                }
              }

              return { styles, adopted };
            }

            return {
              fileTree: getRootStyles(document.querySelector('file-tree-container')),
              diffs: getRootStyles(document.querySelector('diffs-container'))
            };
          })()
        `;

        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression, returnByValue: true, awaitPromise: true }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id === 1) {
            clearTimeout(timeout);
            ws.close();
            resolve(data.result?.result?.value || {});
          }
        } catch (err) {
          clearTimeout(timeout);
          ws.close();
          reject(err);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>}
 * @throws {void}
 */
async function main() {
  const wsUrl = await getMainPageWsUrl(PORT);
  if (!wsUrl) return;
  const res = await inspectShadowStyles(wsUrl);
  console.log(JSON.stringify(res, null, 2));
}

main();
