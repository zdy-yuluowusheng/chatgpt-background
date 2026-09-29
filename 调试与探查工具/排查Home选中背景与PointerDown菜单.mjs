/**
 * @file 排查Home选中背景与PointerDown菜单.mjs
 * @description 排查 Home 按钮在选中态下的计算样式与背后背景层，并通过 dispatch pointerdown 事件打开个人菜单
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
        id: 8001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 8001) {
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
async function captureScreenshot(fileName = '排查截屏.png', port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  const outputPath = path.resolve(__dirname, fileName);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 8002,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 90 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 8002) {
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
  // 1. 排查 Home 按钮及其子节点与父节点
  const homeProbeCode = `
    (() => {
      const homeBtn = document.querySelector('button[data-sidebar-destination="builtin:home"]');
      if (!homeBtn) return { error: '未找到 homeBtn' };

      const getStyleInfo = (el, name) => {
        const s = window.getComputedStyle(el);
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        return {
          name,
          tag: el.tagName,
          cls: el.className,
          bg: s.backgroundColor,
          bgImg: s.backgroundImage,
          boxShadow: s.boxShadow,
          borderRadius: s.borderRadius,
          border: s.border,
          color: s.color,
          beforeBg: before.backgroundColor,
          afterBg: after.backgroundColor,
          w: el.offsetWidth,
          h: el.offsetHeight
        };
      };

      const items = [];
      items.push(getStyleInfo(homeBtn.parentElement, 'Parent (wrapper)'));
      items.push(getStyleInfo(homeBtn, 'Home Button'));
      Array.from(homeBtn.children).forEach((child, idx) => {
        items.push(getStyleInfo(child, 'Child ' + idx));
        Array.from(child.children).forEach((grand, gidx) => {
          items.push(getStyleInfo(grand, 'GrandChild ' + idx + '-' + gidx));
        });
      });

      return { items };
    })()
  `;

  const homeData = await evalInCodex(homeProbeCode);
  console.log('=== Home 按钮及其层级计算样式 ===');
  console.log(JSON.stringify(homeData, null, 2));

  // 2. 模拟 pointerdown / click 弹出个人资料菜单
  const triggerAvatarCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (!avatarBtn) return { found: false };

      // 依次触发 pointerdown, mousedown, pointerup, mouseup, click
      const rect = avatarBtn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, button: 0 };

      avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
      avatarBtn.dispatchEvent(new MouseEvent('mousedown', opts));
      avatarBtn.dispatchEvent(new PointerEvent('pointerup', opts));
      avatarBtn.dispatchEvent(new MouseEvent('mouseup', opts));
      avatarBtn.dispatchEvent(new MouseEvent('click', opts));

      return { found: true, id: avatarBtn.id, state: avatarBtn.getAttribute('data-state') };
    })()
  `;

  const trigRes = await evalInCodex(triggerAvatarCode);
  console.log('触发头像事件结果:', trigRes);

  await new Promise(r => setTimeout(r, 600));

  // 检查此时所有可见的浮层或菜单
  const popoverCheckCode = `
    (() => {
      const results = [];
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent || '';
        if (text.includes('剩余用量') && text.includes('退出登录') && el.offsetWidth > 150 && el.offsetHeight > 100) {
          const s = window.getComputedStyle(el);
          results.push({
            tag: el.tagName,
            cls: el.className,
            role: el.getAttribute('role'),
            id: el.id,
            bg: s.backgroundColor,
            bgImg: s.backgroundImage,
            border: s.border,
            boxShadow: s.boxShadow,
            borderRadius: s.borderRadius,
            backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
            w: el.offsetWidth,
            h: el.offsetHeight,
            outerSnippet: el.outerHTML.slice(0, 300)
          });
        }
      });
      return results;
    })()
  `;

  const popovers = await evalInCodex(popoverCheckCode);
  console.log('\n=== 个人菜单容器 ===');
  console.log(JSON.stringify(popovers, null, 2));

  await captureScreenshot('个人菜单展开排查.png');
}

main().catch(console.error);
