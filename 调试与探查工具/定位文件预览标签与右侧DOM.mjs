/**
 * @file 定位文件预览标签与右侧DOM.mjs
 * @description 寻找包含“符合性评审测试报告”的所有节点，探查其所在的 TabBar、面板容器以及内容渲染区域的具体 DOM。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查文件预览 Tab 与右侧容器
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 通信失败时抛出异常
 */
function inspectDocxPreviewDom(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          // 查找包含 符合性评审测试报告 的节点
          const matchedNodes = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (walker.currentNode.textContent.includes('符合性评审测试报告')) {
              matchedNodes.push(walker.currentNode.parentElement);
            }
          }

          // 寻找 Tab 和其对应的 Panel
          const reports = matchedNodes.map(node => {
            const path = [];
            let cur = node;
            while (cur && cur !== document.body) {
              const cs = window.getComputedStyle(cur);
              path.push({
                tag: cur.tagName.toLowerCase(),
                className: String(cur.className).substring(0, 80),
                dataset: { ...cur.dataset },
                rect: cur.getBoundingClientRect(),
                filter: cs.filter,
                backdropFilter: cs.backdropFilter,
                opacity: cs.opacity
              });
              cur = cur.parentElement;
            }
            return {
              text: node.textContent,
              tag: node.tagName,
              path
            };
          });

          // 探查主窗口右侧的所有同级或面板
          const rightContainer = document.querySelector('[class*="WorkspaceContent"]');
          let workspaceChildren = [];
          if (rightContainer) {
            workspaceChildren = Array.from(rightContainer.children).map(c => {
              const cs = window.getComputedStyle(c);
              return {
                tag: c.tagName.toLowerCase(),
                className: c.className,
                rect: c.getBoundingClientRect(),
                bg: cs.backgroundColor,
                backdropFilter: cs.backdropFilter,
                filter: cs.filter,
                innerHtmlSnippet: c.innerHTML.substring(0, 300)
              };
            });
          }

          return {
            reports,
            workspaceChildren
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
  const detail = await inspectDocxPreviewDom(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(detail, null, 2));
}

main();
