/**
 * @file 滚动至代码块并实体验证.mjs
 * @description 寻找包含“Illegal mix of collations”的具体代码块，找到其父级真正具有 overflow-y 的滚动容器并设置其 scrollTop，使代码块完全处于视口中并截屏。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 滚动父容器并截屏
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @param {string} screenshotPath - 输出截图路径
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 通信失败或未找到元素时抛出异常
 */
function scrollParentAndCapture(wsUrl, screenshotPath) {
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
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (walker.currentNode.textContent.includes('Illegal mix of collations')) {
              target = walker.currentNode.parentElement;
              break;
            }
          }

          if (!target) return { found: false };

          const block = target.closest('[data-code-block]') || target.closest('[class*="CodeBlock"]') || target;
          
          const sc = document.querySelector('.thread-scroll-container');
          if (sc) {
            // 获取 block 相对于 sc 的位置
            const scRect = sc.getBoundingClientRect();
            const blockRect = block.getBoundingClientRect();
            const offsetRelativeToSc = blockRect.top - scRect.top + sc.scrollTop;
            sc.scrollTo({ top: offsetRelativeToSc - 50, behavior: 'instant' });
          } else {
            block.scrollIntoView({ block: 'center', inline: 'center' });
          }

          return {
            found: true,
            scScrollTop: sc ? sc.scrollTop : null,
            scScrollHeight: sc ? sc.scrollHeight : null,
            blockRectAfter: block.getBoundingClientRect()
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
      const data = JSON.parse(event.data);
      if (data.id === 1) {
        console.log('滚动探查结果:', data.result?.result?.value);
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 600);
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
  await scrollParentAndCapture(page.webSocketDebuggerUrl, 'd:/work/chatgpt-background/调试与探查工具/报错代码块精准视口截图.png');
}

main();
