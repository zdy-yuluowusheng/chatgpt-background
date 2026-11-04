/**
 * @file 生成最终验收截图.mjs
 * @description 捕获当前 ChatGPT/Codex 桌面端界面的高清全屏截图，保存为正式验收文件。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';
const OUTPUT_PATH = 'd:/work/chatgpt-background/验收_代码块与对话背景透明化修复后效果.png';

/**
 * 捕获当前页面截图并保存
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @param {string} outPath - 文件输出路径
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 通信失败时抛出异常
 */
function captureFinalScreenshot(wsUrl, outPath) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 截图超时'));
    }, 8000);

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
          const base64Data = data.result?.data;
          if (base64Data) {
            fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
            console.log(`验收截图已保存至: ${outPath}`);
          }
          ws.close();
          resolve();
        }
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    };

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
  await captureFinalScreenshot(page.webSocketDebuggerUrl, OUTPUT_PATH);
}

main();
