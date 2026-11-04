/**
 * @file 抓取当前最新实时屏幕.mjs
 * @description 捕获当前页面截图，保存为实时对比文件。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 抓取当前屏幕并保存
 * 
 * @param {string} outPath - 输出图片文件路径
 * @returns {Promise<void>} 无返回值
 * @throws {Error} CDP连接失败时抛出异常
 */
async function captureNow(outPath) {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    };
    ws.onmessage = (evt) => {
      const data = JSON.parse(evt.data);
      if (data.id === 1) {
        fs.writeFileSync(outPath, Buffer.from(data.result.data, 'base64'));
        console.log('截图成功:', outPath);
        ws.close();
        resolve();
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

captureNow('d:/work/chatgpt-background/调试与探查工具/实时状态排查截图.png').catch(console.error);
