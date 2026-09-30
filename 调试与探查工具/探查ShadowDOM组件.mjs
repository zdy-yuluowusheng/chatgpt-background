/**
 * @file 探查ShadowDOM组件.mjs
 * @description 探查 file-tree-container 与 diffs-container 是否包含 Shadow DOM，并探测内部的背景色。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取主页面 WebSocket 调试 URL
 * 
 * @param {number} port - CDP 端口
 * @returns {Promise<string|null>} WebSocket URL
 * @throws {void} 捕获异常返回 null
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
 * 探查自定义组件的 Shadow DOM 结构
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 结果
 * @throws {Error} 异常
 */
function inspectCustomElements(wsUrl) {
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
            const ft = document.querySelector('file-tree-container');
            const diffs = document.querySelector('diffs-container');

            function inspectElement(el) {
              if (!el) return null;
              const hasShadow = !!el.shadowRoot;
              let shadowBgs = [];
              if (hasShadow) {
                const all = el.shadowRoot.querySelectorAll('*');
                all.forEach(c => {
                  const s = window.getComputedStyle(c);
                  if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
                    shadowBgs.push({
                      tag: c.tagName.toLowerCase(),
                      className: c.className,
                      bg: s.backgroundColor,
                      styleAttr: c.getAttribute('style')
                    });
                  }
                });
              }

              return {
                tag: el.tagName.toLowerCase(),
                hasShadow,
                shadowMode: el.shadowRoot ? el.shadowRoot.mode : null,
                styleAttr: el.getAttribute('style'),
                shadowBgCount: shadowBgs.length,
                shadowBgs: shadowBgs.slice(0, 20)
              };
            }

            return {
              fileTree: inspectElement(ft),
              diffs: inspectElement(diffs)
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
  const res = await inspectCustomElements(wsUrl);
  console.log(JSON.stringify(res, null, 2));
}

main();
