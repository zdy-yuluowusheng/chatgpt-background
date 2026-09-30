/**
 * @file 探查右侧面板内部层次.mjs
 * @description 深入扫描所有 tabpanel 内部的节点结构及背景色分布
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取 CDP targets
 * 
 * @param {number} port - 端口
 * @returns {Promise<Array<object>|null>} 目标列表
 * @throws {void} 捕获并返回 null
 */
async function getCdpTargets(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 探查 tabpanel 及其子元素
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 错误抛出
 */
function inspectTabsAndPanels(wsUrl) {
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
            const panels = Array.from(document.querySelectorAll('[role="tabpanel"], [data-app-shell-tab-panel-controller], [data-tab-id]'));
            
            const panelDetails = panels.map(p => {
              // 收集该面板内部所有有背景的元素
              const bgDescendants = [];
              const allChildren = p.querySelectorAll('*');
              allChildren.forEach(child => {
                const cs = window.getComputedStyle(child);
                const bg = cs.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                  bgDescendants.push({
                    tag: child.tagName.toLowerCase(),
                    className: child.className && typeof child.className === 'string' ? child.className : '',
                    id: child.id || undefined,
                    bg: bg,
                    attrs: Array.from(child.attributes).filter(a => a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'class').map(a => \`\${a.name}="\${a.value.slice(0, 40)}"\`),
                    textSnippet: child.children.length === 0 ? child.textContent?.slice(0, 40) : undefined
                  });
                }
              });

              return {
                id: p.id,
                role: p.getAttribute('role'),
                label: p.getAttribute('aria-label'),
                tabId: p.getAttribute('data-tab-id'),
                className: p.className,
                bg: window.getComputedStyle(p).backgroundColor,
                bgCount: bgDescendants.length,
                bgDescendants: bgDescendants.slice(0, 30) // 取前30个有背景的元素
              };
            });

            // 同时检查右侧顶部的标签条容器（Tab header bar）
            const headerBars = Array.from(document.querySelectorAll('header, [data-app-shell-header-toolbar], [class*="_Toolbar_"], [class*="_TabStrip_"], [role="tablist"]')).map(h => ({
              tag: h.tagName.toLowerCase(),
              className: h.className,
              bg: window.getComputedStyle(h).backgroundColor,
              outerSnippet: h.outerHTML.slice(0, 200)
            }));

            return {
              panelDetails,
              headerBars
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
 * @returns {Promise<void>} 无返回值
 * @throws {void} 捕获异常
 */
async function main() {
  const targets = await getCdpTargets(PORT);
  if (!targets) return;
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) return;
  const res = await inspectTabsAndPanels(page.webSocketDebuggerUrl);
  console.log('详细面板探查结果:');
  console.log(JSON.stringify(res, null, 2));
}

main();
