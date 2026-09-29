/**
 * @file 测试壁纸垂直偏移与极致透光.js
 * @description 测试微调 background-position 配合高透亮毛玻璃输入框，观察整体画面的视觉和谐度
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 注入测试参数并分别截取全屏与输入框特写
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 异常时抛出错误
 */
async function testWallpaperShiftAndGlass(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) throw new Error('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          // 尝试微调 body 的 background-position 到 center 65%
          document.body.style.setProperty('background-position', 'center 62%', 'important');

          const el = document.querySelector('[class*="_ComposerLayoutRoot_"]');
          if (el) {
            el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.06)', 'important');
            el.style.setProperty('background', 'rgba(255, 255, 255, 0.06)', 'important');
            el.style.setProperty('backdrop-filter', 'blur(8px) saturate(140%) brightness(130%)', 'important');
            el.style.setProperty('-webkit-backdrop-filter', 'blur(8px) saturate(140%) brightness(130%)', 'important');
            el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.22)', 'important');
            el.style.setProperty('box-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.18), inset 0 1px 0 0 rgba(255, 255, 255, 0.25)', 'important');
          }

          return { success: true };
        })()
      `;
      ws.send(JSON.stringify({ id: 7001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 7001) {
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 7002,
            method: 'Page.captureScreenshot',
            params: { format: 'png', quality: 90 }
          }));
        }, 200);
      } else if (msg.id === 7002) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          const outPath = path.resolve(__dirname, '壁纸偏移与输入框测试.png');
          fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
          console.log(`[测试完成] 截图已保存: ${outPath}`);
          ws.close();
        }
      }
    };
  } catch (err) {
    console.error('异常:', err);
  }
}

testWallpaperShiftAndGlass();
