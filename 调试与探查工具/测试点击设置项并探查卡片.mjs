/**
 * @file 测试点击设置项并探查卡片.mjs
 * @description 聚焦并触发设置项菜单，使页面跳转到设置界面，并探查所有卡片结构
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
        id: 9981,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9981) {
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
 * 截屏
 * @param {string} fileName
 * @param {number} port
 */
async function captureScreenshot(fileName, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  const outputPath = path.resolve(__dirname, fileName);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 9982,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9982) {
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
  const triggerCode = `
    (() => {
      // 1. 查找头像按钮
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (!avatarBtn) return { error: '未找到头像按钮' };

      const rect = avatarBtn.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: rect.x + 10, clientY: rect.y + 10, pointerId: 1, button: 0 };
      avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
      avatarBtn.dispatchEvent(new MouseEvent('mousedown', opts));
      avatarBtn.dispatchEvent(new PointerEvent('pointerup', opts));
      avatarBtn.dispatchEvent(new MouseEvent('mouseup', opts));
      avatarBtn.dispatchEvent(new MouseEvent('click', opts));

      return { menuOpened: true };
    })()
  `;

  await evalInCodex(triggerCode);
  await new Promise(r => setTimeout(r, 400));

  // 2. 选择设置项并触发 Enter 键或 pointerdown/up
  const selectSettingCode = `
    (() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const setItem = items.find(it => (it.textContent || '').includes('设置'));
      if (!setItem) return { error: '未找到设置菜单项' };

      setItem.focus();
      // 触发 keydown Enter
      setItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      // 同时也触发 click
      setItem.click();

      return { selected: true, text: setItem.textContent };
    })()
  `;

  const selRes = await evalInCodex(selectSettingCode);
  console.log('选择设置项结果:', selRes);

  await new Promise(r => setTimeout(r, 800));

  await captureScreenshot('测试打开设置结果.png');
  console.log('截图完成: 测试打开设置结果.png');
}

main().catch(console.error);
