/**
 * @file 精确定位并滚动报错会话.mjs
 * @description 寻找包含“Illegal mix of collations”的节点并向上回溯找到其消息外层容器，调用 scrollIntoView 并截屏。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 定位目标元素并执行滚动与截屏
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @param {string} screenshotPath - 输出截图路径
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 通信失败或未找到元素时抛出异常
 */
function locateScrollAndCapture(wsUrl, screenshotPath) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 12000);

    ws.onopen = () => {
      const expr = `
        (() => {
          let target = null;
          // 查找文本包含 Illegal mix of collations 的最小节点
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (walker.currentNode.textContent.includes('Illegal mix of collations')) {
              target = walker.currentNode.parentElement;
              break;
            }
          }

          if (target) {
            // 找到包含它的代码块或消息气泡
            const block = target.closest('[data-code-block]') || target.closest('[class*="CodeBlock"]') || target;
            block.scrollIntoView({ behavior: 'instant', block: 'center' });
            return {
              found: true,
              tag: block.tagName,
              className: block.className,
              rect: block.getBoundingClientRect()
            };
          }
          return { found: false };
        })()
      `;

      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === 1) {
        console.log('定位结果:', data.result?.result?.value);
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 500);
      } else if (data.id === 2) {
        clearTimeout(timeout);
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync(screenshotPath, Buffer.from(base64Data, 'base64'));
          console.log(`截图已保存至: ${screenshotPath}`);
        }
        ws.close();
        resolve();
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
  await locateScrollAndCapture(page.webSocketDebuggerUrl, 'd:/work/chatgpt-background/调试与探查工具/报错代码块精准截图.png');
}

main();
