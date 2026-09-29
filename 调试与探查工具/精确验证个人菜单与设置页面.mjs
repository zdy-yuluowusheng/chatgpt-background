/**
 * @file 精确验证个人菜单与设置页面.mjs
 * @description 依次打开个人资料菜单截取图一，并点击进入设置详情页截取图二，完整验证透明雾化效果
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
        id: 9801,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9801) {
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
        id: 9802,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9802) {
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
 * 主验证逻辑
 */
async function main() {
  // 1. 如果当前在会话中，先点击返回按钮返回主页
  const backToHomeCode = `
    (() => {
      const backBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const r = b.getBoundingClientRect();
        return r.left < 50 && r.top < 30 && b.querySelector('svg');
      });
      if (backBtn) backBtn.click();
      return true;
    })()
  `;
  await evalInCodex(backToHomeCode);
  await new Promise(r => setTimeout(r, 600));

  // 2. 触发左下角头像按钮弹出个人菜单
  const triggerAvatarCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (!avatarBtn) return { success: false, reason: '未找到头像按钮' };

      const rect = avatarBtn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 };

      avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
      avatarBtn.dispatchEvent(new MouseEvent('mousedown', opts));
      avatarBtn.dispatchEvent(new PointerEvent('pointerup', opts));
      avatarBtn.dispatchEvent(new MouseEvent('mouseup', opts));
      avatarBtn.dispatchEvent(new MouseEvent('click', opts));

      return { success: true };
    })()
  `;
  const avatarRes = await evalInCodex(triggerAvatarCode);
  console.log('触发头像菜单:', avatarRes);

  await new Promise(r => setTimeout(r, 600));

  // 3. 截取图一（个人菜单展开状态）
  await captureScreenshot('图一验收_主页与个人菜单.png');
  console.log('已截图: 图一验收_主页与个人菜单.png');

  // 4. 从展开的菜单中点击“设置”
  const clickSettingCode = `
    (() => {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"], div[class*="menu"] *'));
      const setItem = allItems.find(it => (it.textContent || '').trim().startsWith('设置'));
      if (setItem) {
        const rect = setItem.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: rect.top + 10, pointerId: 1, button: 0 };
        setItem.dispatchEvent(new PointerEvent('pointerdown', opts));
        setItem.dispatchEvent(new MouseEvent('mousedown', opts));
        setItem.dispatchEvent(new PointerEvent('pointerup', opts));
        setItem.dispatchEvent(new MouseEvent('mouseup', opts));
        setItem.dispatchEvent(new MouseEvent('click', opts));
        return { success: true, text: setItem.textContent };
      }
      return { success: false, reason: '未找到设置菜单项' };
    })()
  `;
  const setRes = await evalInCodex(clickSettingCode);
  console.log('点击设置项结果:', setRes);

  await new Promise(r => setTimeout(r, 800));

  // 5. 截取图二（设置界面详情状态）
  await captureScreenshot('图二验收_设置界面详情.png');
  console.log('已截图: 图二验收_设置界面详情.png');
}

main().catch(console.error);
