/**
 * @file 探查客户端标签类型与组件结构.mjs
 * @description 点击切换到另一个Tab以捕获预览DOM，同时在内存中搜索所有Tab面板类型与组件定义。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取主页面的 WebSocket URL
 * 
 * @param {number} port - CDP 端口
 * @returns {Promise<string|null>} WebSocket URL
 * @throws {void} 捕获并返回 null
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
 * 在页面内执行探查
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 结果
 * @throws {Error} 错误抛出
 */
function inspectTabsAndPanels(wsUrl) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('超时'));
      }, 10000);

      ws.onopen = () => {
        const expression = `
          (() => {
            const results = {};

            // 1. 查找右侧边栏内所有的面板定义
            const aside = document.querySelector('aside[data-app-shell-focus-area="right-panel"]');
            
            // 2. 检查当前打开的文件预览 tab 的内容
            const htmlTab = document.getElementById('app-shell-tab-app-shell-tab:1');
            if (htmlTab) {
              results.htmlTabFound = true;
              results.htmlTabAria = {
                controls: htmlTab.getAttribute('aria-controls'),
                label: htmlTab.getAttribute('aria-label')
              };
            }

            // 3. 检查所有 role="tabpanel"
            const panels = Array.from(document.querySelectorAll('[role="tabpanel"]')).map(p => ({
              id: p.id,
              label: p.getAttribute('aria-label'),
              tabId: p.getAttribute('data-tab-id'),
              className: p.className,
              outerHTMLSnippet: p.outerHTML.slice(0, 1000)
            }));
            results.panels = panels;

            // 4. 寻找终端相关的标签或组件（比如 xterm, terminal, monaco, code-mirror）
            const terminalNodes = Array.from(document.querySelectorAll('[class*="terminal"], [class*="xterm"], [data-testid*="terminal"], xterm, [class*="console"]')).map(n => ({
              tag: n.tagName.toLowerCase(),
              className: n.className,
              parentTag: n.parentElement?.tagName.toLowerCase()
            }));
            results.terminalNodes = terminalNodes;

            // 5. 寻找审批相关的标签或组件（比如 approval, review, changeset）
            const approvalNodes = Array.from(document.querySelectorAll('[class*="approval"], [class*="review"], [data-testid*="approval"], [data-testid*="review"]')).map(n => ({
              tag: n.tagName.toLowerCase(),
              className: n.className,
              parentTag: n.parentElement?.tagName.toLowerCase()
            }));
            results.approvalNodes = approvalNodes;

            // 6. 寻找 markdown 预览组件（比如 markdown-preview, data-markdown, prose）
            const markdownNodes = Array.from(document.querySelectorAll('[class*="markdown-preview"], [data-testid*="markdown"], [class*="prose"]')).map(n => ({
              tag: n.tagName.toLowerCase(),
              className: n.className
            }));
            results.markdownNodes = markdownNodes;

            // 7. 搜索所有包含 background 样式的 class 或内联样式在右侧区域的分布
            if (aside) {
              const asideBgElements = [];
              aside.querySelectorAll('*').forEach(el => {
                const s = window.getComputedStyle(el);
                if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
                  asideBgElements.push({
                    selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.split(' ').join('.') : ''),
                    bg: s.backgroundColor
                  });
                }
              });
              results.asideBgElements = asideBgElements;
            }

            return results;
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
  const res = await inspectTabsAndPanels(wsUrl);
  console.log(JSON.stringify(res, null, 2));
}

main();
