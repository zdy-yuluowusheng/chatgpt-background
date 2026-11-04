/**
 * @file 精准排查右侧模糊元素.mjs
 * @description 针对屏幕右半部分（x > 400 且 宽度 > 200）的所有元素，检查其 filter、backdropFilter、以及其子元素/伪元素是否有 blur 属性。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查右半区域具有模糊样式的元素
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<Array<object>>} 模糊元素列表
 * @throws {Error} 通信失败时抛出异常
 */
function inspectRightAreaBlur(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const matched = [];
          const allEls = document.querySelectorAll('*');

          for (const el of allEls) {
            const rect = el.getBoundingClientRect();
            // 右半屏主要内容区域
            if (rect.width > 150 && rect.height > 150 && rect.left > 300) {
              const cs = window.getComputedStyle(el);
              const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
              const f = cs.filter || cs.webkitFilter || 'none';
              const opacity = cs.opacity;

              matched.push({
                tag: el.tagName.toLowerCase(),
                className: String(el.className).substring(0, 100),
                dataset: { ...el.dataset },
                id: el.id,
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                backdropFilter: bdf,
                filter: f,
                bg: cs.backgroundColor,
                bgImg: cs.backgroundImage !== 'none' ? cs.backgroundImage.substring(0, 60) : 'none',
                opacity
              });
            }
          }

          // 另外检索页面上所有包含 docx、iframe、webview、embed、object 的元素
          const previewTargets = Array.from(document.querySelectorAll('iframe, webview, embed, object, [class*="preview"], [class*="viewer"], [class*="docx"], [class*="doc"], [data-tab-id]')).map(p => {
            const cs = window.getComputedStyle(p);
            const rect = p.getBoundingClientRect();
            return {
              tag: p.tagName.toLowerCase(),
              className: String(p.className).substring(0, 100),
              dataset: { ...p.dataset },
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
              backdropFilter: cs.backdropFilter,
              filter: cs.filter,
              bg: cs.backgroundColor
            };
          });

          return {
            largeRightElements: matched.filter(m => m.backdropFilter !== 'none' || m.filter !== 'none'),
            allRightContainers: matched.slice(0, 20),
            previewTargets
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
  const report = await inspectRightAreaBlur(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(report, null, 2));
}

main();
