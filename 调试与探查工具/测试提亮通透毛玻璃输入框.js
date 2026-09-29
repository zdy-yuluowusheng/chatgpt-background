/**
 * @file 测试提亮通透毛玻璃输入框.js
 * @description 实时通过 CDP 动态调整输入框的 backdrop-filter (引入 brightness 与 saturate) 及通透度并截取特写
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 注入测试样式并截取输入框特写
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 调试端口
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 异常时抛出错误
 */
async function testBrightTranslucentComposer(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) throw new Error('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 动态将测试样式应用到 Composer 节点
      const expr = `
        (() => {
          const el = document.querySelector('[class*="_ComposerLayoutRoot_"]');
          if (!el) return null;

          el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.08)', 'important');
          el.style.setProperty('background', 'rgba(255, 255, 255, 0.08)', 'important');
          el.style.setProperty('backdrop-filter', 'blur(10px) saturate(140%) brightness(130%)', 'important');
          el.style.setProperty('-webkit-backdrop-filter', 'blur(10px) saturate(140%) brightness(130%)', 'important');
          el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.22)', 'important');
          el.style.setProperty('box-shadow', '0 8px 32px 0 rgba(0, 0, 0, 0.20), inset 0 1px 0 0 rgba(255, 255, 255, 0.25)', 'important');

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
      ws.send(JSON.stringify({ id: 6001, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 6001) {
        const clip = msg.result?.result?.value;
        if (!clip) {
          ws.close();
          return console.log('未找到输入框坐标');
        }
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 6002,
            method: 'Page.captureScreenshot',
            params: { format: 'png', quality: 95, clip: clip }
          }));
        }, 200);
      } else if (msg.id === 6002) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          const outPath = path.resolve(__dirname, '输入框提亮特写测试.png');
          fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
          console.log(`[测试完成] 提亮特写截图已保存: ${outPath}`);
          ws.close();
        }
      }
    };
  } catch (err) {
    console.error('测试异常:', err);
  }
}

testBrightTranslucentComposer();
