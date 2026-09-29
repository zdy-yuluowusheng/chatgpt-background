/**
 * @file 截取输入框特写截图.js
 * @description 针对 Composer 输入框区域进行局部高精截屏，便于精准核验玻璃通透度与质感
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 捕获输入框局部特写画面
 * 
 * @param {string} targetUrl - 目标页面 URL 匹配片段
 * @param {number} port - CDP 调试端口
 * @returns {Promise<string>} 返回保存图片的绝对路径
 * @throws {Error} 异常时抛出错误
 */
async function captureComposerCloseup(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) throw new Error(`未找到目标页面: ${targetUrl}`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl);

      ws.onopen = () => {
        // 先获取 Composer 的精确屏幕裁剪区域
        const expr = `
          (() => {
            const el = document.querySelector('[class*="_ComposerLayoutRoot_"]');
            if (!el) return null;
            const r = el.getBoundingClientRect();
            // 上下左右留出 30px 外边距观察与壁纸的融合
            return {
              x: Math.max(0, r.left - 40),
              y: Math.max(0, r.top - 30),
              width: r.width + 80,
              height: r.height + 60,
              scale: 1
            };
          })()
        `;
        ws.send(JSON.stringify({ id: 5001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 5001) {
          const clip = msg.result?.result?.value;
          if (!clip) {
            ws.close();
            return reject(new Error('未找到输入框边界尺寸'));
          }
          ws.send(JSON.stringify({
            id: 5002,
            method: 'Page.captureScreenshot',
            params: {
              format: 'png',
              quality: 95,
              clip: clip
            }
          }));
        } else if (msg.id === 5002) {
          const base64Data = msg.result?.data;
          if (base64Data) {
            const outPath = path.resolve(__dirname, '输入框特写预览.png');
            fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
            console.log(`[特写成功] 特写截图已保存: ${outPath}`);
            ws.close();
            resolve(outPath);
          } else {
            ws.close();
            reject(new Error('未收到特写截图数据'));
          }
        }
      };

      ws.onerror = (err) => reject(err);
    });
  } catch (err) {
    console.error('截取特写失败:', err);
    throw err;
  }
}

captureComposerCloseup();
