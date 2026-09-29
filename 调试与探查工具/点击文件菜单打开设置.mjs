/**
 * @file 点击文件菜单打开设置.mjs
 * @description 点击顶部“文件”菜单并选择“设置”，或者通过 history/router 导航至设置界面
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
        id: 9701,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9701) {
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
        id: 9702,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9702) {
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
 * 主逻辑
 */
async function main() {
  // 点击文件菜单
  const clickFileCode = `
    (() => {
      const fileBtn = document.getElementById('application-menu-trigger-file-menu');
      if (fileBtn) {
        fileBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()
  `;
  const res = await evalInCodex(clickFileCode);
  console.log('点击文件菜单结果:', res);

  await new Promise(r => setTimeout(r, 400));

  // 探查弹出的菜单项
  const probeMenuCode = `
    (() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map(it => ({
        text: (it.textContent || '').trim(),
        role: it.getAttribute('role'),
        id: it.id
      }));
      return items;
    })()
  `;
  const items = await evalInCodex(probeMenuCode);
  console.log('文件菜单项:', items);

  // 点击“设置”项
  const clickSettingItemCode = `
    (() => {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const set = allItems.find(i => (i.textContent || '').includes('设置'));
      if (set) {
        set.click();
        return true;
      }
      return false;
    })()
  `;
  const setClicked = await evalInCodex(clickSettingItemCode);
  console.log('点击设置项:', setClicked);

  await new Promise(r => setTimeout(r, 800));

  await captureScreenshot('打开设置后的效果.png');
  console.log('已截图: 打开设置后的效果.png');
}

main().catch(console.error);
