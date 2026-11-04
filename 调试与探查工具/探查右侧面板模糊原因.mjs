/**
 * @file 探查右侧面板模糊原因.mjs
 * @description 扫描当前打开文件预览时的右侧面板，寻找所有设置了 backdrop-filter 或 filter blur 的元素，并输出其标签、类名、匹配的 CSS 规则及祖先层级。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查右侧面板及其模糊样式来源
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 通信失败时抛出异常
 */
function inspectRightPanelBlur(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const blurredElements = [];
          const allEls = document.querySelectorAll('*');

          for (const el of allEls) {
            // 跳过 svg 内部节点
            if (el instanceof SVGElement) continue;

            const cs = window.getComputedStyle(el);
            const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
            const f = cs.filter || cs.webkitFilter || 'none';

            if ((bdf !== 'none' && bdf.includes('blur')) || (f !== 'none' && f.includes('blur'))) {
              // 找到其尺寸和位置
              const rect = el.getBoundingClientRect();
              // 收集其祖先
              const path = [];
              let cur = el;
              while (cur && cur !== document.body) {
                path.push(cur.tagName.toLowerCase() + (cur.className ? '.' + String(cur.className).replace(/\\s+/g, '.') : ''));
                cur = cur.parentElement;
              }

              blurredElements.push({
                tag: el.tagName.toLowerCase(),
                className: String(el.className).substring(0, 150),
                id: el.id,
                dataset: { ...el.dataset },
                backdropFilter: bdf,
                filter: f,
                rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                path: path.slice(0, 6)
              });
            }
          }

          // 另外检索右侧面板相关的元素
          const rightPanels = Array.from(document.querySelectorAll('[data-app-shell-focus-area="right-panel"], [data-app-shell-tab-panel-controller="right"], [data-app-shell-pane-frame], aside, webview, iframe')).map(p => {
            const cs = window.getComputedStyle(p);
            return {
              tag: p.tagName.toLowerCase(),
              className: String(p.className).substring(0, 100),
              dataset: { ...p.dataset },
              bg: cs.backgroundColor,
              backdropFilter: cs.backdropFilter,
              filter: cs.filter,
              rect: p.getBoundingClientRect()
            };
          });

          return {
            blurredElements,
            rightPanels
          };
        })()
      `;

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
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  console.log(`正在探查页面: ${page.title}`);
  const report = await inspectRightPanelBlur(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(report, null, 2));
}

main();
