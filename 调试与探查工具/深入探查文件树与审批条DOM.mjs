/**
 * @file 深入探查文件树与审批条DOM.mjs
 * @description 探查右侧边栏中当前仍存在背景色的节点（如文件树、底部审批条等），定位精确选择器。
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
 * 探查右侧面板内所有可见且具有非透明背景的元素
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<Array<object>>} 结果列表
 * @throws {Error} 异常时抛出
 */
function inspectRemainingBg(wsUrl) {
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
            const aside = document.querySelector('aside[data-app-shell-focus-area="right-panel"]');
            if (!aside) return { error: '未找到 aside' };

            const items = [];
            const all = aside.querySelectorAll('*');
            all.forEach(el => {
              const cs = window.getComputedStyle(el);
              const bg = cs.backgroundColor;
              const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
              if (hasBg && el.offsetWidth > 10 && el.offsetHeight > 10) {
                // 计算相对选择器推荐
                const rect = el.getBoundingClientRect();
                items.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || undefined,
                  className: el.className && typeof el.className === 'string' ? el.className : '',
                  attrs: Array.from(el.attributes)
                    .filter(a => a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'role')
                    .map(a => \`\${a.name}="\${a.value.slice(0, 40)}"\`),
                  bg: bg,
                  rect: { left: Math.round(rect.left), top: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
                });
              }
            });

            // 另外检查整个页面中所有 fixed / absolute 的 review 审批条与底栏
            const bottomBars = [];
            document.querySelectorAll('[class*="review"], [class*="approval"], [class*="bottom-bar"], [data-testid*="review"], [data-testid*="approval"], [role="toolbar"], [class*="StickyActionBar"]').forEach(b => {
              const cs = window.getComputedStyle(b);
              const rect = b.getBoundingClientRect();
              if (rect.width > 50 && rect.height > 20) {
                bottomBars.push({
                  tag: b.tagName.toLowerCase(),
                  className: b.className,
                  bg: cs.backgroundColor,
                  rect: { left: Math.round(rect.left), top: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
                  attrs: Array.from(b.attributes).map(a => \`\${a.name}="\${a.value.slice(0, 30)}"\`)
                });
              }
            });

            return { items, bottomBars };
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
  const res = await inspectRemainingBg(wsUrl);
  console.log(JSON.stringify(res, null, 2));
}

main();
