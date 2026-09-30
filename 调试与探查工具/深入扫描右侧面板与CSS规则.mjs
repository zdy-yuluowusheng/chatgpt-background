/**
 * @file 深入扫描右侧面板与CSS规则.mjs
 * @description 深入扫描 Codex 客户端右侧边栏的 DOM 结构，并从内置样式表中提取所有关于右侧面板、终端、代码预览、Markdown、审批等的 CSS 类名和选择器。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取活跃的目标页面
 * 
 * @param {number} port - CDP 端口
 * @returns {Promise<string|null>} 目标主页面 WebSocket URL
 * @throws {void} 捕获所有异常
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
 * 执行探查代码并返回分析结果
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 错误抛出
 */
function analyzeStylesAndDom(wsUrl) {
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

            // 1. 获取右侧边栏根容器结构
            const rightAside = document.querySelector('aside[data-app-shell-focus-area="right-panel"]');
            if (rightAside) {
              results.asideHtml = rightAside.outerHTML.slice(0, 3000);
              
              // 收集内部所有有直接 background-color 的元素并生成它们的选择器推荐
              const bgElements = [];
              const all = rightAside.querySelectorAll('*');
              all.forEach(el => {
                const style = window.getComputedStyle(el);
                const bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                  bgElements.push({
                    tag: el.tagName.toLowerCase(),
                    id: el.id,
                    className: el.className,
                    bg: bg,
                    dataAttrs: Array.from(el.attributes)
                      .filter(a => a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'role')
                      .map(a => \`\${a.name}="\${a.value}"\`)
                  });
                }
              });
              results.bgElements = bgElements;
            }

            // 2. 搜索 styleSheets 中相关的选择器
            const matchedRules = [];
            const keywords = ['diff', 'terminal', 'preview', 'markdown', 'approval', 'review', 'browser', 'right-panel', 'tab-panel', 'file-tree'];
            try {
              for (const sheet of document.styleSheets) {
                try {
                  const rules = sheet.cssRules || sheet.rules;
                  if (!rules) continue;
                  for (const rule of rules) {
                    if (rule.selectorText) {
                      const sel = rule.selectorText.toLowerCase();
                      for (const kw of keywords) {
                        if (sel.includes(kw)) {
                          matchedRules.push(rule.selectorText);
                          break;
                        }
                      }
                      if (matchedRules.length > 80) break;
                    }
                  }
                } catch (e) {
                  // 忽略跨域样式表
                }
                if (matchedRules.length > 80) break;
              }
            } catch (e) {}
            results.matchedRules = matchedRules.slice(0, 50);

            // 3. 检查所有存在的 tab 及其控制的 tabpanel
            const tabs = Array.from(document.querySelectorAll('[role="tab"]')).map(t => ({
              id: t.id,
              text: t.textContent?.trim(),
              controls: t.getAttribute('aria-controls'),
              selected: t.getAttribute('aria-selected'),
              tabId: t.getAttribute('data-tab-id')
            }));
            results.tabs = tabs;

            const tabPanels = Array.from(document.querySelectorAll('[role="tabpanel"], [data-app-shell-tab-panel-controller]')).map(p => ({
              id: p.id,
              ariaLabel: p.getAttribute('aria-label'),
              tabId: p.getAttribute('data-tab-id'),
              className: p.className,
              outerSnippet: p.outerHTML.slice(0, 500)
            }));
            results.tabPanels = tabPanels;

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
 * 主执行入口
 * 
 * @returns {Promise<void>} 无返回值
 * @throws {void} 捕获异常
 */
async function main() {
  const wsUrl = await getMainPageWsUrl(PORT);
  if (!wsUrl) {
    console.error('未找到目标主页面');
    return;
  }
  const report = await analyzeStylesAndDom(wsUrl);
  console.log('分析结果:');
  console.log(JSON.stringify(report, null, 2));
}

main();
