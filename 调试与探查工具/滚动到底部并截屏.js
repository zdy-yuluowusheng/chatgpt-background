/**
 * @file 滚动到底部并截屏.js
 * @description 将对话列表平滑滚动回底部并截取最新实机画面
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 滚动对话列表到底部并捕获画面
 * 
 * @param {string} targetUrl - 目标页面 URL 匹配片段
 * @param {number} port - CDP 调试端口
 * @returns {Promise<string>} 返回保存截图的绝对路径
 * @throws {Error} CDP 通信失败或无法找到目标时抛出异常
 */
async function scrollToBottomAndCapture(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) {
      throw new Error(`未找到目标页面: ${targetUrl}`);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl);

      ws.onopen = () => {
        const expr = `
          (() => {
            const scrollers = Array.from(document.querySelectorAll('.thread-scroll-container'));
            const scroller = scrollers.find(s => s.clientHeight > 0);
            if (scroller) {
              scroller.scrollTop = scroller.scrollHeight;
              return { scrolled: true, scrollTop: scroller.scrollTop };
            }
            return { scrolled: false };
          })()
        `;
        ws.send(JSON.stringify({ id: 1401, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 1401) {
          setTimeout(() => {
            ws.send(JSON.stringify({ id: 1402, method: 'Page.captureScreenshot', params: { format: 'png', quality: 90 } }));
          }, 300);
        } else if (msg.id === 1402) {
          const base64Data = msg.result?.data;
          if (base64Data) {
            const outPath = path.resolve(__dirname, '渲染效果预览_底部.png');
            fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
            console.log(`[截图成功] 底部视图已保存: ${outPath}`);
            ws.close();
            resolve(outPath);
          } else {
            ws.close();
            reject(new Error('未收到截图数据'));
          }
        }
      };

      ws.onerror = (err) => {
        reject(err);
      };
    });
  } catch (err) {
    console.error('执行失败:', err);
    throw err;
  }
}

scrollToBottomAndCapture();
