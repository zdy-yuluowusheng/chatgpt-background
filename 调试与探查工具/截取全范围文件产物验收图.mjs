/**
 * @file 截取全范围文件产物验收图.mjs
 * @description 截取包含 Excel 和 Word 多种文件型产物的全景对话特写，验证双重边框消除效果
 * @author Antigravity
 */

import fs from 'fs';

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在目标 WebSocket 上执行指令
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} method - CDP 方法名
 * @param {object} params - 参数对象
 * @returns {Promise<any>} 执行结果
 * @throws {Error} 通信失败或超时
 */
function sendCdpCommand(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`CDP ${method} 超时`));
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve(data.result);
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
  const targets = await res.json();
  const mainPage = targets.find(t => t.type === 'page' && t.url.includes('index.html'));

  const clipScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 390,
      y: 100,
      width: 780,
      height: 650,
      scale: 1
    }
  });

  if (clipScreenshot?.data) {
    const savePath = 'd:\\work\\chatgpt-background\\调试与探查工具\\多文件产物单层透明框验收.png';
    fs.writeFileSync(savePath, Buffer.from(clipScreenshot.data, 'base64'));
    console.log(`多文件产物验收图已保存至: ${savePath}`);
  }
}

main().catch(console.error);
