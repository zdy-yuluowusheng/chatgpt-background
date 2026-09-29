/**
 * @file 滚动页面并截屏.js
 * @description 将对话列表向上滚动一定距离以露出 Bash 命令块并截屏核验
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 滚动对话并截屏
 * 
 * @param {number} scrollDeltaY - 滚动偏移量（正数向下，负数向上）
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function scrollAndCapture(scrollDeltaY = -350, targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const scrollers = Array.from(document.querySelectorAll('.thread-scroll-container'));
          const scroller = scrollers.find(s => s.clientHeight > 0);
          if (scroller) {
            scroller.scrollTop -= 600;
            return {
              scrolled: true,
              scrollTop: scroller.scrollTop,
              scrollHeight: scroller.scrollHeight,
              clientHeight: scroller.clientHeight
            };
          }
          return { scrolled: false };
        })()
      `;
      ws.send(JSON.stringify({ id: 1301, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1301) {
        console.log('[滚动结果]', d.result?.result?.value);
        setTimeout(() => {
          ws.send(JSON.stringify({ id: 1302, method: 'Page.captureScreenshot', params: { format: 'png', quality: 90 } }));
        }, 500);
      } else if (d.id === 1302) {
        const base64Data = d.result?.data;
        if (base64Data) {
          const outPath = path.resolve(__dirname, '渲染效果预览.png');
          fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
          console.log(`[截屏成功] 已保存至: ${outPath}`);
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

scrollAndCapture();
