/**
 * @file 探查文件树祖先与背景.mjs
 * @description 探查文件树所在的列容器及其所有父级、祖先级与内部节点的背景来源。
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
 * 执行元素层级追踪
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 结果
 * @throws {Error} 异常
 */
function traceFileTreeHierarchy(wsUrl) {
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
            if (!ft) return { error: '未找到 file-tree-container' };

            // 1. 查看 ft 的计算样式和所有属性
            const ftStyle = window.getComputedStyle(ft);
            const ftInfo = {
              tag: ft.tagName.toLowerCase(),
              className: ft.className,
              bg: ftStyle.backgroundColor,
              rect: ft.getBoundingClientRect()
            };

            // 2. 向上追溯所有的父元素及其背景色
            const ancestors = [];
            let p = ft.parentElement;
            while (p && p.tagName.toLowerCase() !== 'body') {
              const ps = window.getComputedStyle(p);
              ancestors.push({
                tag: p.tagName.toLowerCase(),
                className: p.className,
                id: p.id || undefined,
                bg: ps.backgroundColor,
                attrs: Array.from(p.attributes).map(a => \`\${a.name}="\${a.value.slice(0, 50)}"\`),
                rect: { w: p.offsetWidth, h: p.offsetHeight, left: p.getBoundingClientRect().left }
              });
              p = p.parentElement;
            }

            // 3. 向下查找 ft 内部的所有有背景的子元素
            const children = [];
            ft.querySelectorAll('*').forEach(c => {
              const cs = window.getComputedStyle(c);
              if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
                children.push({
                  tag: c.tagName.toLowerCase(),
                  className: c.className,
                  bg: cs.backgroundColor,
                  text: c.textContent?.slice(0, 30)
                });
              }
            });

            // 4. document.elementFromPoint 测试：检查点击右侧文件树区域时，最上层的元素是什么
            const pointEl = document.elementFromPoint(1150, 400);
            const pointElInfo = pointEl ? {
              tag: pointEl.tagName.toLowerCase(),
              className: pointEl.className,
              bg: window.getComputedStyle(pointEl).backgroundColor,
              outerHTMLSnippet: pointEl.outerHTML.slice(0, 300)
            } : null;

            return { ftInfo, ancestors, children, pointElInfo };
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
  const res = await traceFileTreeHierarchy(wsUrl);
  console.log(JSON.stringify(res, null, 2));
}

main();
