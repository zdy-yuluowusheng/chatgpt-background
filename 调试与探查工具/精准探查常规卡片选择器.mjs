/**
 * @file 精准探查常规卡片选择器.mjs
 * @description 进入设置界面，探查“常规”卡片及其内部行的确切标签、类名与样式，解决未命中问题
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
        id: 9991,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9991) {
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
 * 主逻辑
 */
async function main() {
  // 1. 打开头像菜单
  const triggerAvatarCode = `
    (() => {
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (!avatarBtn) return false;
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
    })()
  `;
  await evalInCodex(triggerAvatarCode);
  await new Promise(r => setTimeout(r, 500));

  // 2. 点击设置
  const clickSettingCode = `
    (() => {
      const allItems = Array.from(document.querySelectorAll('[role="menuitem"], div[class*="menu"] *'));
      const setItem = allItems.find(it => (it.textContent || '').trim().startsWith('设置'));
      if (!setItem) return false;
      const rect = setItem.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: rect.top + 10, pointerId: 1, button: 0 };
      setItem.dispatchEvent(new PointerEvent('pointerdown', opts));
      setItem.dispatchEvent(new MouseEvent('mousedown', opts));
      setItem.dispatchEvent(new PointerEvent('pointerup', opts));
      setItem.dispatchEvent(new MouseEvent('mouseup', opts));
      setItem.dispatchEvent(new MouseEvent('click', opts));
      return true;
    })()
  `;
  await evalInCodex(clickSettingCode);
  await new Promise(r => setTimeout(r, 700));

  // 3. 探查包含“集成终端 Shell”或“无项目任务文件夹”的元素
  const probeGeneralCode = `
    (() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      const targetTextEl = allEls.find(el => (el.textContent || '').trim() === '集成终端 Shell');
      if (!targetTextEl) return { error: '未找到 集成终端 Shell' };

      const hierarchy = [];
      let cur = targetTextEl;
      while (cur && cur !== document.body) {
        const s = window.getComputedStyle(cur);
        hierarchy.push({
          tag: cur.tagName,
          cls: cur.className,
          bg: s.backgroundColor,
          border: s.border,
          borderRadius: s.borderRadius,
          w: cur.offsetWidth,
          h: cur.offsetHeight,
          childrenCount: cur.children.length
        });
        cur = cur.parentElement;
      }

      return { hierarchy };
    })()
  `;

  const data = await evalInCodex(probeGeneralCode);
  console.log('=== 集成终端 Shell 祖先链 ===');
  data.hierarchy?.forEach((node, i) => {
    console.log(`[${i}] <${node.tag} class="${node.cls}"> bg: ${node.bg}, radius: ${node.borderRadius}, w: ${node.w}, h: ${node.h}`);
  });
}

main().catch(console.error);
