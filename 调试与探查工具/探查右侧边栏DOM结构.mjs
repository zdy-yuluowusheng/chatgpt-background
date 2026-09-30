/**
 * @file 探查右侧边栏DOM结构.mjs
 * @description 通过 CDP 探测当前运行的 Codex / ChatGPT 客户端中右侧边栏及其子面板（文件预览、代码预览、Markdown、审批、终端、浏览器等）的 DOM 结构与背景颜色。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取活跃的 CDP 目标列表
 * 
 * @param {number} port - CDP 调试端口
 * @returns {Promise<Array<object>|null>} 目标列表或 null
 * @throws {void} 捕获所有错误并安全返回 null
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
 * 通过 WebSocket 在页面上下文执行探测函数
 * 
 * @param {string} wsUrl - CDP WebSocket URL
 * @returns {Promise<object>} 页面分析结果
 * @throws {Error} 连接或执行失败抛出错误
 */
function probeSidebar(wsUrl) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('CDP 探查请求超时'));
      }, 8000);

      ws.onopen = () => {
        // 在页面内执行探查
        const expression = `
          (() => {
            const results = {
              windowWidth: window.innerWidth,
              windowHeight: window.innerHeight,
              elementsWithBg: [],
              layoutPanels: [],
              tabs: [],
              rightAreaHierarchy: []
            };

            // 1. 查找右半区域的大容器
            const allElements = Array.from(document.querySelectorAll('*'));
            
            // 找出位于屏幕右半侧并且尺寸较大的元素
            const rightElements = allElements.filter(el => {
              const rect = el.getBoundingClientRect();
              return rect.width > 200 && rect.height > 200 && rect.left >= window.innerWidth * 0.3;
            });

            // 检查带背景色（非全透明）的元素
            rightElements.forEach(el => {
              const style = window.getComputedStyle(el);
              const bg = style.backgroundColor;
              const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
              if (hasBg) {
                // 收集有背景色的关键大容器
                const rect = el.getBoundingClientRect();
                results.elementsWithBg.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || undefined,
                  className: el.className && typeof el.className === 'string' ? el.className.split(' ').slice(0, 5).join(' ') : '',
                  dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-') || a.name.startsWith('aria-')).map(a => \`\${a.name}="\${a.value.slice(0, 30)}"\`),
                  bg: bg,
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  left: Math.round(rect.left),
                  top: Math.round(rect.top)
                });
              }
            });

            // 2. 检查顶层布局容器和面板
            const potentialPanels = document.querySelectorAll('main, aside, section, [data-panel], [data-panel-group], [data-app-shell-right-panel], [class*="right"], [class*="panel"], [class*="side"], [class*="drawer"], [class*="tab"]');
            potentialPanels.forEach(el => {
              const rect = el.getBoundingClientRect();
              if (rect.width > 100 && rect.height > 100) {
                const style = window.getComputedStyle(el);
                results.layoutPanels.push({
                  tag: el.tagName.toLowerCase(),
                  id: el.id || undefined,
                  className: el.className && typeof el.className === 'string' ? el.className : '',
                  attrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'role').map(a => \`\${a.name}="\${a.value}"\`),
                  rect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
                  bg: style.backgroundColor
                });
              }
            });

            // 3. 检查打开的标签栏结构
            const tabElements = document.querySelectorAll('[role="tab"], [role="tablist"], [data-tab], [class*="tab-"], [class*="tab_"], [class*="Tab"]');
            tabElements.forEach(t => {
              results.tabs.push({
                tag: t.tagName.toLowerCase(),
                text: t.textContent?.slice(0, 30)?.trim(),
                className: t.className && typeof t.className === 'string' ? t.className : '',
                attrs: Array.from(t.attributes).map(a => \`\${a.name}="\${a.value.slice(0, 30)}"\`)
              });
            });

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
 * 运行探查主流程
 * 
 * @returns {Promise<void>} 无返回值
 * @throws {void} 捕获异常输出
 */
async function main() {
  const targets = await getCdpTargets(PORT);
  if (!targets || targets.length === 0) {
    console.error('未探测到 CDP 目标');
    return;
  }
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) {
    console.error('未找到 page 目标');
    return;
  }
  console.log(`正在探查页面: ${page.title}`);
  const data = await probeSidebar(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(data, null, 2));
}

main();
