/**
 * @file 点击打开右侧预览面板.mjs
 * @description 在当前页面中点击附件或已编辑文件，触发右侧面板打开，并截屏且探查右侧面板所有的类名和计算样式。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 触发右侧面板展开并探查
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<object>} 探查结果
 * @throws {Error} CDP通信失败时抛出异常
 */
function openAndInspectRightPanel(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 12000);

    ws.onopen = () => {
      const expr = `
        (() => {
          // 查找可点击的文件卡片或查看变更按钮
          const diffBtn = document.querySelector('button:has(svg), [class*="resource-card"], button:has([class*="size-10"])') ||
                          Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('查看变更') || el.textContent.includes('xlsx') || el.textContent.includes('docx'));
          
          let clicked = false;
          let clickedText = '';
          if (diffBtn) {
            clickedText = diffBtn.innerText || diffBtn.textContent;
            diffBtn.click();
            clicked = true;
          }

          return { clicked, clickedText };
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
        console.log('点击结果:', data.result?.result?.value);
        // 延时等待面板动画展开
        setTimeout(() => {
          // 探查右侧区域
          const inspectExpr = `
            (() => {
              const allEls = document.querySelectorAll('*');
              const rightEls = [];
              for (const el of allEls) {
                if (el instanceof SVGElement) continue;
                const rect = el.getBoundingClientRect();
                if (rect.left >= 400 && rect.width > 200 && rect.height > 200) {
                  const cs = window.getComputedStyle(el);
                  rightEls.push({
                    tag: el.tagName.toLowerCase(),
                    className: String(el.className).substring(0, 100),
                    id: el.id,
                    dataset: { ...el.dataset },
                    rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
                    bg: cs.backgroundColor,
                    bgImg: cs.backgroundImage !== 'none' ? cs.backgroundImage.substring(0, 40) : 'none',
                    backdropFilter: cs.backdropFilter,
                    filter: cs.filter,
                    opacity: cs.opacity
                  });
                }
              }
              return rightEls;
            })()
          `;

          ws.send(JSON.stringify({
            id: 2,
            method: 'Runtime.evaluate',
            params: { expression: inspectExpr, returnByValue: true, awaitPromise: true }
          }));
        }, 1000);
      } else if (data.id === 2) {
        const rightEls = data.result?.result?.value;
        // 截图
        ws.send(JSON.stringify({
          id: 3,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
        this_rightEls = rightEls;
      } else if (data.id === 3) {
        clearTimeout(timeout);
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync('d:/work/chatgpt-background/调试与探查工具/右侧面板展开实时截图.png', Buffer.from(base64Data, 'base64'));
          console.log('已保存右侧面板展开截图');
        }
        ws.close();
        resolve(this_rightEls);
      }
    };

    let this_rightEls = null;

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
  const info = await openAndInspectRightPanel(page.webSocketDebuggerUrl);
  console.log(JSON.stringify(info, null, 2));
}

main();
