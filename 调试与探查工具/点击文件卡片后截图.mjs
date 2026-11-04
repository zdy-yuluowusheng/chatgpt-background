/**
 * @file 点击文件预览卡片.mjs
 * @description 准确找到包含“Word”或“Excel”或“已编辑”的文件卡片并触发点击，使右侧面板打开。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 触发指定文件卡片点击
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<void>} 无返回值
 * @throws {Error} CDP通信失败时抛出异常
 */
function clickFileCard(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 12000);

    ws.onopen = () => {
      const expr = `
        (() => {
          // 查找包含 围串标检测系统测试用例 或 符合性评审 或 已编辑 的卡片
          const cards = Array.from(document.querySelectorAll('[class*="resource-card"], [class*="composer-attachment-surface"], div:has(> [class*="size-10"]), button:has([class*="size-10"])'));
          let target = null;
          for (const card of cards) {
            if (card.textContent.includes('xlsx') || card.textContent.includes('docx') || card.textContent.includes('已编辑')) {
              target = card;
              break;
            }
          }
          if (target) {
            // 点击该卡片
            const btn = target.querySelector('button') || target;
            btn.click();
            return { found: true, text: target.innerText };
          }
          return { found: false, totalCards: cards.length };
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
        console.log('点击目标结果:', data.result?.result?.value);
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
          fs.writeFileSync('d:/work/chatgpt-background/调试与探查工具/点击文件卡片后截图.png', Buffer.from(base64Data, 'base64'));
          console.log('已保存点击后截图');
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
  await clickFileCard(page.webSocketDebuggerUrl);
}

main();
