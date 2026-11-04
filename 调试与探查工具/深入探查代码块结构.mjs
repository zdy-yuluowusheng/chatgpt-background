/**
 * @file 深入探查代码块结构.mjs
 * @description 针对当前 ChatGPT 渲染的代码块，详细抓取其 DOM 结构、类名、数据属性、子元素以及具体 CSS 属性。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 深入探查首个代码块的完整结构
 * 
 * @param {string} wsUrl - CDP WebSocket URL
 * @returns {Promise<object>} 代码块详细数据
 * @throws {Error} CDP 通信失败时抛出异常
 */
function inspectCodeBlockDetail(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expression = `
        (() => {
          const block = document.querySelector('[data-code-block="true"]');
          if (!block) return { error: '未找到 data-code-block 元素' };

          /**
           * 递归序列化节点信息
           * 
           * @param {Element} node - DOM节点
           * @param {number} depth - 递归深度
           * @returns {object} 节点序列化信息
           */
          function serialize(node, depth = 0) {
            if (depth > 5) return null;
            const cs = window.getComputedStyle(node);
            return {
              tag: node.tagName.toLowerCase(),
              className: node.className,
              id: node.id,
              dataset: { ...node.dataset },
              bg: cs.backgroundColor,
              bgImage: cs.backgroundImage,
              border: cs.border,
              borderRadius: cs.borderRadius,
              children: Array.from(node.children).map(c => serialize(c, depth + 1))
            };
          }

          return {
            block: serialize(block),
            outerHtml: block.outerHTML.substring(0, 500)
          };
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
  const detail = await inspectCodeBlockDetail(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(detail, null, 2));
}

main();
