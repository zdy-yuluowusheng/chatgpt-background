/**
 * @file 截取页面渲染截图.js
 * @description 通过 Chrome DevTools Protocol (CDP) 调用 Page.captureScreenshot 截取当前 ChatGPT/Codex 真实渲染画面
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 截取目标页面的实际渲染截图并写入本地图片文件
 * 
 * @param {string} targetUrl - 目标页面的 URL 匹配片段
 * @param {string} outputFileName - 保存的图片文件名（默认为 '渲染效果预览.png'）
 * @param {number} port - CDP 调试端口
 * @returns {Promise<string>} 返回保存的图片绝对路径
 * @throws {Error} 当 CDP 连接失败或截图指令异常时抛出错误
 */
async function capturePageScreenshot(targetUrl = 'app://-/index.html', outputFileName = '渲染效果预览.png', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url === targetUrl) || targets.find(t => t.url && t.url.includes(targetUrl) && !t.url.includes('initialRoute'));
    if (!target) {
      throw new Error(`未找到匹配 ${targetUrl} 的页面目标`);
    }

    console.log(`[截图工具] 正在连接目标: ${target.title} (${target.id})`);
    const outputPath = path.resolve(__dirname, outputFileName);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(target.webSocketDebuggerUrl);

      ws.onopen = () => {
        // 请求 CDP 截取页面全屏
        ws.send(JSON.stringify({
          id: 8001,
          method: 'Page.captureScreenshot',
          params: { format: 'png', quality: 90 }
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 8001) {
          if (msg.error) {
            ws.close();
            return reject(new Error(`Page.captureScreenshot 失败: ${JSON.stringify(msg.error)}`));
          }
          const base64Data = msg.result?.data;
          if (base64Data) {
            fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
            console.log(`[截图成功] 已保存截图至: ${outputPath}`);
            ws.close();
            resolve(outputPath);
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
    console.error(`[截图异常] ${err.message}`);
    throw err;
  }
}

capturePageScreenshot();
