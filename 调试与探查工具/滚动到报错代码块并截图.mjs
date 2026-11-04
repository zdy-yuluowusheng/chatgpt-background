/**
 * @file 滚动到报错代码块并截图.mjs
 * @description 找到包含“Illegal mix of collations”的代码块，将其滚动到视口中央并截图，直观验证透明修复效果。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 滚动到目标元素并截图
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @param {string} screenshotPath - 输出截图路径
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 通信失败或未找到元素时抛出异常
 */
function scrollAndCapture(wsUrl, screenshotPath) {
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
          for (const el of document.querySelectorAll('*')) {
            if (el.children.length === 0 && el.textContent.includes('Illegal mix of collations')) {
              target = el;
              break;
            }
          }
          if (target) {
            target.scrollIntoView({ behavior: 'instant', block: 'center' });
            return true;
          }
          return false;
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
  await scrollAndCapture(page.webSocketDebuggerUrl, 'd:/work/chatgpt-background/调试与探查工具/测试代码块透明修复后具体效果.png');
}

main();
