/**
 * @file 截取当前界面.mjs
 * @description 通过 CDP 截取当前运行中的 Codex / ChatGPT 主界面，保存为本地图片用于核对和验收。
 * @author Antigravity Assistant
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取主页面的 WebSocket URL
 * 
 * @param {number} port - CDP 端口
 * @returns {Promise<string|null>} 主窗口的调试 WebSocket URL
 * @throws {void} 捕获所有异常
 */
async function getMainPageWsUrl(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html') && !t.url.includes('initialRoute'));
    return page ? page.webSocketDebuggerUrl : null;
  } catch {
    return null;
  }
}

/**
 * 截取页面并保存为 png 文件
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} outputPath - 输出图片路径
 * @returns {Promise<string>} 输出图片绝对路径
 * @throws {Error} 异常时抛出
 */
function captureScreenshot(wsUrl, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('截图超时'));
      }, 10000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Page.captureScreenshot',
          params: { format: 'png' }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id === 1) {
            clearTimeout(timeout);
            ws.close();
            const buffer = Buffer.from(data.result.data, 'base64');
            fs.writeFileSync(outputPath, buffer);
            resolve(outputPath);
          }
        } catch (err) {
          clearTimeout(timeout);
          ws.close();
          reject(err);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 执行入口
 * 
 * @returns {Promise<void>}
 * @throws {void}
 */
async function main() {
  const wsUrl = await getMainPageWsUrl(PORT);
  if (!wsUrl) {
    console.error('未找到主页面');
    return;
  }
  const outPath = path.resolve(__dirname, '../验收_当前右侧边栏实际状态.png');
  await captureScreenshot(wsUrl, outPath);
  console.log(`截图已保存到: ${outPath}`);
}

main();
