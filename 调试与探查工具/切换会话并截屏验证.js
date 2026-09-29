/**
 * @file 切换会话并截屏验证.js
 * @description 点击侧边栏切换至指定会话（如“定位专家模块后端接口”），并即时截屏验证渲染效果
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 切换会话并截屏
 * 
 * @param {string} sessionName - 需要切换的目标会话标题名称
 * @param {string} targetUrl - 调试目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function switchSessionAndCapture(sessionName = '定位专家模块后端接口', targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 查找并模拟点击
      const expr = `
        (() => {
          const items = Array.from(document.querySelectorAll('a, button, [role="button"], div.sidebar-item, [class*="sidebar"] div'));
          const found = items.find(el => (el.textContent || '').trim() === '${sessionName}');
          if (found) {
            found.click();
            return { success: true, text: found.textContent };
          }
          return { success: false };
        })()
      `;
      ws.send(JSON.stringify({ id: 1101, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = async (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1101) {
        console.log('[切换会话结果]', d.result?.result?.value);
        // 等待 800ms 渲染完成后请求截图
        setTimeout(() => {
          ws.send(JSON.stringify({ id: 1102, method: 'Page.captureScreenshot', params: { format: 'png', quality: 90 } }));
        }, 800);
      } else if (d.id === 1102) {
        const base64Data = d.result?.data;
        if (base64Data) {
          const outPath = path.resolve(__dirname, '渲染效果预览.png');
          fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
          console.log(`[截屏成功] 已更新截屏至: ${outPath}`);
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

switchSessionAndCapture();
