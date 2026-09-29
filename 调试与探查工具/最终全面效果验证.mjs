/**
 * @file 最终全面效果验证.mjs
 * @description 滚动设置详情到顶部截取图二完整卡片，并返回主页展开个人菜单截取图一，生成最终验收截图
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
        id: 9551,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9551) {
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
        id: 9552,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9552) {
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
  // 1. 设置内容区域滚动到顶部
  const scrollToTopCode = `
    (() => {
      const scrollContainer = document.querySelector('div.flex-1.scrollbar-stable.overflow-y-auto') ||
                              document.querySelector('[data-app-shell-focus-area="main"] .overflow-y-auto');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(scrollToTopCode);
  await new Promise(r => setTimeout(r, 400));

  // 2. 截取图二：设置界面详情（权限卡片与常规卡片）
  await captureScreenshot('验收截图_图二设置界面各菜单详情透明雾化.png');
  console.log('[1/3] 已生成图二验收截图: 验收截图_图二设置界面各菜单详情透明雾化.png');

  // 3. 点击返回箭头回到主页面
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

  // 4. 弹出个人资料菜单
  const triggerAvatarCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (avatarBtn) {
        const rect = avatarBtn.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 };
        avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        avatarBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        avatarBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        avatarBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        avatarBtn.dispatchEvent(new MouseEvent('click', opts));
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(triggerAvatarCode);
  await new Promise(r => setTimeout(r, 600));

  // 5. 截取图一：主页与个人菜单（侧边栏图标与个人菜单透明雾化）
  await captureScreenshot('验收截图_图一侧边栏图标与个人菜单透明雾化.png');
  console.log('[2/3] 已生成图一验收截图: 验收截图_图一侧边栏图标与个人菜单透明雾化.png');
}

main().catch(console.error);
