/**
 * @file 点击特定Word卡片展开预览.mjs
 * @description 寻找包含“remove_dyc”或“Word 分页效果”的消息附件卡片，模拟点击其主体部分，在右侧触发打开并捕获截图。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 寻找卡片并点击
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 通信失败时抛出异常
 */
function clickWordCardExact(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 15000);

    ws.onopen = () => {
      const expr = `
        (() => {
          // 查找包含 remove_dyc 或 符合性评审测试报告 或 docx 的特定卡片
          let targetCard = null;
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el.textContent.includes('remove_dyc') || el.textContent.includes('Word 分页效果尚未视觉核验')) {
              // 向上找到 turn
              const turn = el.closest('[data-virtualized-turn-content]') || el.closest('[class*="turn"]') || el.parentElement;
              // 在该 turn 内查找包含 Word 或 符合性评审 的卡片
              const cards = (turn || document).querySelectorAll('[class*="resource-card"], [class*="composer-attachment-surface"], button:has([class*="size-10"]), div:has(> [class*="size-10"])');
              for (const c of cards) {
                if (c.textContent.includes('Word') || c.textContent.includes('docx') || c.textContent.includes('符合性评审')) {
                  targetCard = c;
                  break;
                }
              }
              if (targetCard) break;
            }
          }

          if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'instant', block: 'center' });
            // 点击该卡片主体（避免点到打开方式下拉箭头）
            const clickTarget = targetCard.querySelector('[class*="size-10"]') || targetCard;
            clickTarget.click();
            return { found: true, text: targetCard.innerText };
          }

          // 降级：直接全局寻找包含 符合性评审测试报告 的 Word 卡片
          for (const el of document.querySelectorAll('*')) {
            if (el.children.length === 0 && (el.textContent.includes('符合性评审') || el.textContent.includes('Word'))) {
              const card = el.closest('[class*="resource-card"]') || el.closest('button') || el.parentElement;
              if (card) {
                card.click();
                return { found: true, text: card.innerText, fallback: true };
              }
            }
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
        console.log('点击卡片响应:', data.result?.result?.value);
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 1500);
      } else if (data.id === 2) {
        clearTimeout(timeout);
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync('d:/work/chatgpt-background/调试与探查工具/点击Word卡片后真实效果.png', Buffer.from(base64Data, 'base64'));
          console.log('截图已保存: d:/work/chatgpt-background/调试与探查工具/点击Word卡片后真实效果.png');
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
  await clickWordCardExact(page.webSocketDebuggerUrl);
}

main();
