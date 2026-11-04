/**
 * @file 穿透ShadowDOM排查模糊根因.mjs
 * @description 递归穿透所有的 Shadow Root、iframe、webview 以及全页面所有节点和伪元素，
 *              精准查出究竟是哪个元素带有 filter: blur 或 backdrop-filter: blur，或者哪条 CSS 规则生效导致了模糊。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 递归收集一个 DOM 树及其内部所有 open 模式 Shadow DOM 中的模糊元素
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 详细的模糊检测报告
 * @throws {Error} 通信失败时抛出异常
 */
function deepAuditShadowDomBlur(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 10000);

    ws.onopen = () => {
      const expr = `
        (() => {
          const blurredNodes = [];
          
          /**
           * 递归遍历节点及其 ShadowRoot
           * 
           * @param {Node} root - 根节点
           * @param {string} context - 上下文路径
           */
          function traverse(root, context = '') {
            if (!root) return;
            const elements = root.querySelectorAll ? root.querySelectorAll('*') : [];
            for (const el of elements) {
              if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;

              const cs = window.getComputedStyle(el);
              const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
              const f = cs.filter || cs.webkitFilter || 'none';

              if ((bdf !== 'none' && bdf.includes('blur')) || (f !== 'none' && f.includes('blur'))) {
                const rect = el.getBoundingClientRect();
                blurredNodes.push({
                  context,
                  tag: el.tagName.toLowerCase(),
                  className: String(el.className).substring(0, 150),
                  id: el.id,
                  dataset: { ...el.dataset },
                  rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                  backdropFilter: bdf,
                  filter: f,
                  bg: cs.backgroundColor
                });
              }

              // 检查是否有 ShadowRoot
              if (el.shadowRoot) {
                traverse(el.shadowRoot, context + ' -> ' + el.tagName.toLowerCase() + '#' + (el.id || el.className));
              }
            }
          }

          traverse(document.body, 'document.body');

          // 获取右侧区域所有大容器的标签与类名
          const rightBigElements = [];
          for (const el of document.querySelectorAll('*')) {
            const rect = el.getBoundingClientRect();
            if (rect.left > 400 && rect.width > 200 && rect.height > 200) {
              const cs = window.getComputedStyle(el);
              rightBigElements.push({
                tag: el.tagName.toLowerCase(),
                className: String(el.className).substring(0, 100),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                bg: cs.backgroundColor,
                backdropFilter: cs.backdropFilter,
                filter: cs.filter,
                hasShadow: !!el.shadowRoot
              });
            }
          }

          return {
            blurredNodes,
            rightBigElements
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
  console.log(`正在深度探查: ${page.title}`);
  const report = await deepAuditShadowDomBlur(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(report, null, 2));
}

main();
