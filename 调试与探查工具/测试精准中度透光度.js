/**
 * @file 测试精准中度透光度.js
 * @description 将输入框亮度精确回调至约 48%~50% 的黄金平衡区间（融合暗绿松林底色与轻柔微光）并捕获特写
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 注入平衡档位样式并截取特写
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 异常时抛出错误
 */
async function testBalancedOpacity(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) throw new Error('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const el = document.querySelector('[class*="_ComposerLayoutRoot_"]');
          if (!el) return null;

          // 回调至 48%~50% 区间：轻度松林冷灰底色 + 温和微光提亮 (brightness 108% 代替 130%)
          el.style.setProperty('background-color', 'rgba(14, 22, 19, 0.24)', 'important');
          el.style.setProperty('background', 'rgba(14, 22, 19, 0.24)', 'important');
          el.style.setProperty('backdrop-filter', 'blur(12px) saturate(125%) brightness(108%)', 'important');
          el.style.setProperty('-webkit-backdrop-filter', 'blur(12px) saturate(125%) brightness(108%)', 'important');
          el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.16)', 'important');
          el.style.setProperty('box-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.22), inset 0 1px 0 0 rgba(255, 255, 255, 0.16)', 'important');

          const r = el.getBoundingClientRect();
          return {
            x: Math.max(0, r.left - 40),
            y: Math.max(0, r.top - 30),
            width: r.width + 80,
            height: r.height + 60,
            scale: 1
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 8001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 8001) {
        const clip = msg.result?.result?.value;
        if (!clip) {
          ws.close();
          return console.log('未找到输入框坐标');
        }
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 8002,
            method: 'Page.captureScreenshot',
            params: { format: 'png', quality: 95, clip: clip }
          }));
        }, 200);
      } else if (msg.id === 8002) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          const outPath = path.resolve(__dirname, '输入框平衡中度特写.png');
          fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
          console.log(`[测试完成] 平衡中度特写截图已保存: ${outPath}`);
          ws.close();
        }
      }
    };
  } catch (err) {
    console.error('异常:', err);
  }
}

testBalancedOpacity();
