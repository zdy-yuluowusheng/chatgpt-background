/**
 * @file 切换到设置并截屏.mjs
 * @description 通过 CDP 触发快捷键或者路由切换到设置界面，并截取当前屏幕验证设置卡片雾化效果
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 在目标页面执行 JavaScript 脚本并获取结果
 * 
 * @param {string} expr - JavaScript 表达式
 * @param {number} port - 端口号
 * @returns {Promise<any>}
 * @throws {Error}
 */
async function evalInCodex(expr, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  if (!target) throw new Error('未找到主窗口');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 9601,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9601) {
        ws.close();
        if (msg.result?.exceptionDetails) {
          reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        } else {
          resolve(msg.result?.result?.value);
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 通过 CDP Input.dispatchKeyEvent 发送 Ctrl+, 按键
 * 
 * @param {number} port - 端口
 * @returns {Promise<void>}
 */
async function sendCtrlComma(port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 1. 先按下 Control (modifier: 2)
      ws.send(JSON.stringify({
        id: 1,
        method: 'Input.dispatchKeyEvent',
        params: {
          type: 'rawKeyDown',
          windowsVirtualKeyCode: 17,
          key: 'Control',
          code: 'ControlLeft',
          modifiers: 2
        }
      }));

      // 2. 按下逗号 ','
      ws.send(JSON.stringify({
        id: 2,
        method: 'Input.dispatchKeyEvent',
        params: {
          type: 'keyDown',
          windowsVirtualKeyCode: 188,
          key: ',',
          code: 'Comma',
          modifiers: 2
        }
      }));

      // 3. 释放逗号
      ws.send(JSON.stringify({
        id: 3,
        method: 'Input.dispatchKeyEvent',
        params: {
          type: 'keyUp',
          windowsVirtualKeyCode: 188,
          key: ',',
          code: 'Comma',
          modifiers: 2
        }
      }));

      // 4. 释放 Control
      ws.send(JSON.stringify({
        id: 4,
        method: 'Input.dispatchKeyEvent',
        params: {
          type: 'keyUp',
          windowsVirtualKeyCode: 17,
          key: 'Control',
          code: 'ControlLeft',
          modifiers: 0
        }
      }));

      setTimeout(() => {
        ws.close();
        resolve();
      }, 500);
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 截屏
 * @param {string} fileName
 * @param {number} port
 */
async function captureScreenshot(fileName = '设置界面效果.png', port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  const outputPath = path.resolve(__dirname, fileName);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 9603,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9603) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
          ws.close();
          resolve(outputPath);
        } else {
          ws.close();
          reject(new Error('未收到截图数据'));
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('正在发送 Ctrl+, 快捷键打开设置界面...');
  await sendCtrlComma();

  await new Promise(r => setTimeout(r, 800));

  await captureScreenshot('设置界面效果.png');
  console.log('已保存设置界面效果至: 设置界面效果.png');
}

main().catch(console.error);
