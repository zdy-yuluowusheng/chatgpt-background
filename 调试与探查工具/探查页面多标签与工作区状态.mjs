/**
 * @file 探查页面多标签与工作区状态.mjs
 * @description 检查当前 ChatGPT/Codex 页面中打开的 Tab 标签、活跃工作区与会话面板的显示状态。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查工作区与 Tab 状态
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 通信失败时抛出异常
 */
function inspectTabsAndWorkspaces(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const workspaces = Array.from(document.querySelectorAll('[class*="Workspace-"], [class*="WorkspaceContent"]')).map(w => ({
            className: w.className,
            offsetW: w.offsetWidth,
            offsetH: w.offsetHeight,
            rect: w.getBoundingClientRect()
          }));

          const tabs = Array.from(document.querySelectorAll('[role="tab"], [class*="Tab-"], [data-tab-id]')).map(t => ({
            text: t.innerText,
            selected: t.getAttribute('aria-selected') || t.dataset.selected,
            className: t.className
          }));

          const mainList = Array.from(document.querySelectorAll('main, [class*="MainContentSurface"]')).map(m => ({
            tag: m.tagName,
            className: m.className,
            w: m.offsetWidth,
            h: m.offsetHeight,
            rect: m.getBoundingClientRect(),
            parentClass: m.parentElement ? m.parentElement.className : ''
          }));

          return {
            workspaces,
            tabs,
            mainList
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
  const report = await inspectTabsAndWorkspaces(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(report, null, 2));
}

main();
