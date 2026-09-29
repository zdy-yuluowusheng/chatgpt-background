/**
 * @file 进入设置并对比所有卡片结构.mjs
 * @description 切回设置页面，全面探测右侧所有分组卡片的类名结构与选择器规则
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
        id: 9961,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9961) {
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
        id: 9962,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 9962) {
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
  // 1. 展开头像菜单
  const triggerAvatarCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (avatarBtn) {
        const rect = avatarBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.x + 10, clientY: rect.y + 10, pointerId: 1, button: 0 };
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
  await new Promise(r => setTimeout(r, 500));

  // 2. 点击设置
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
        return true;
      }
      return false;
    })()
  `;
  await evalInCodex(clickSettingCode);
  await new Promise(r => setTimeout(r, 700));

  // 3. 详细探查页面中所有具有黑色或深色背景的卡片节点
  const probeCardsCode = `
    (() => {
      const results = [];
      const sections = Array.from(document.querySelectorAll('section'));
      sections.forEach((sec, sidx) => {
        const secInfo = {
          sectionIdx: sidx,
          secTag: sec.tagName,
          secCls: sec.className,
          children: []
        };
        Array.from(sec.children).forEach((child, cidx) => {
          const s = window.getComputedStyle(child);
          secInfo.children.push({
            childIdx: cidx,
            tag: child.tagName,
            cls: child.className,
            bg: s.backgroundColor,
            borderRadius: s.borderRadius,
            border: s.border,
            boxShadow: s.boxShadow,
            textSnippet: (child.textContent || '').trim().slice(0, 40)
          });
        });
        results.push(secInfo);
      });
      return results;
    })()
  `;

  const cardsData = await evalInCodex(probeCardsCode);
  console.log('=== 设置页面所有 Section 及其子节点 ===');
  console.log(JSON.stringify(cardsData, null, 2));

  await captureScreenshot('当前设置详情页面.png');
}

main().catch(console.error);
