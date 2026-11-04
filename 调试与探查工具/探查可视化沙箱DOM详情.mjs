/**
 * @file 探查可视化沙箱DOM详情.mjs
 * @description 深入探查 codex-sandbox 可视化渲染页面的内部 DOM 树结构、内容与渲染组件。
 * @author Antigravity Assistant
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 探查沙箱页面的 DOM
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 通信失败时抛出异常
 */
function inspectSandboxDom(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 探查超时'));
    }, 8000);

    ws.onopen = () => {
      const expr = `
        (() => {
          return {
            html: document.documentElement.outerHTML.substring(0, 1500),
            bodyChildrenCount: document.body.children.length,
            bodyText: document.body.innerText.substring(0, 300)
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
  const sandbox = list.find(t => t.url.includes('sandbox'));
  if (!sandbox) {
    console.log('未找到 sandbox target');
    return;
  }
  console.log(`锁定沙箱: ${sandbox.title} (${sandbox.id})`);
  const detail = await inspectSandboxDom(sandbox.webSocketDebuggerUrl);
  console.log(JSON.stringify(detail, null, 2));
}

main();
