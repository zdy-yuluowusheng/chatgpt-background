/**
 * @file 点击查看变更展开右侧面板.mjs
 * @description 寻找包含“查看变更”的按钮并执行点击，触发右侧 diff 面板展开。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 点击查看变更并截图
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<void>} 无返回值
 * @throws {Error} CDP通信失败时抛出异常
 */
function clickDiffButton(wsUrl) {
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
          for (const btn of document.querySelectorAll('button')) {
            if (btn.textContent.includes('查看变更')) {
              target = btn;
              break;
            }
          }
          if (target) {
            target.click();
            return { found: true, text: target.innerText };
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
        console.log('点击查看变更结果:', data.result?.result?.value);
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 1200);
      } else if (data.id === 2) {
        clearTimeout(timeout);
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync('d:/work/chatgpt-background/调试与探查工具/查看变更展开截图.png', Buffer.from(base64Data, 'base64'));
          console.log('已保存查看变更展开截图');
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
  await clickDiffButton(page.webSocketDebuggerUrl);
}

main();
