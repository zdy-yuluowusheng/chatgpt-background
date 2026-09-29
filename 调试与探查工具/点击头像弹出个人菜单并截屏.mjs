/**
 * @file 点击头像弹出个人菜单并截屏.mjs
 * @description 点击左下角的头像按钮展开个人信息与用量菜单弹层，并截取屏幕验证
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
        id: 7001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 7001) {
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
 * 截取当前主窗口屏幕
 * 
 * @param {string} outputFileName - 保存的文件名
 * @param {number} port - CDP 调试端口
 * @returns {Promise<string>} 返回保存路径
 * @throws {Error}
 */
async function captureScreenshot(outputFileName = '个人菜单展开效果.png', port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  const outputPath = path.resolve(__dirname, outputFileName);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 7002,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 90 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 7002) {
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
 * 主逻辑：点击头像，探查个人菜单 DOM，然后截屏
 * 
 * @returns {Promise<void>}
 */
async function main() {
  const clickCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]') ||
                        document.querySelector('button:has(span[data-ambient-usage-label])') ||
                        document.querySelector('aside button:last-child');
      if (avatarBtn) {
        avatarBtn.click();
        return { clicked: true, ariaLabel: avatarBtn.getAttribute('aria-label') };
      }
      return { clicked: false };
    })()
  `;

  const res = await evalInCodex(clickCode);
  console.log('点击头像结果:', res);

  await new Promise(r => setTimeout(r, 600));

  // 探测弹出的个人菜单
  const probeCode = `
    (() => {
      const results = [];
      document.querySelectorAll('[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper], div[data-state="open"]').forEach(el => {
        if (el.tagName !== 'BUTTON') {
          const style = window.getComputedStyle(el);
          results.push({
            tag: el.tagName,
            cls: el.className,
            role: el.getAttribute('role'),
            bg: style.backgroundColor,
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            border: style.border,
            boxShadow: style.boxShadow,
            rect: { w: el.offsetWidth, h: el.offsetHeight, top: el.offsetTop, left: el.offsetLeft },
            text: (el.textContent || '').trim().slice(0, 100),
            outerSnippet: el.outerHTML.slice(0, 300)
          });
        }
      });
      return results;
    })()
  `;

  const menuInfo = await evalInCodex(probeCode);
  console.log('弹出菜单信息:');
  console.log(JSON.stringify(menuInfo, null, 2));

  await captureScreenshot('个人菜单展开效果.png');
  console.log('已保存个人菜单展开截图至: 个人菜单展开效果.png');
}

main().catch(console.error);
