/**
 * @file 探查所有侧边栏图标与Tooltip内部细节.mjs
 * @description 遍历侧边栏所有导航按钮与顶部工具栏按钮，逐一悬停并探查 Tooltip 内部的 DOM 树、快捷键徽章与样式计算值
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
 * @returns {Promise<any>} 返回表达式计算结果
 * @throws {Error} 连接失败或执行抛出异常时抛出错误
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
        id: 1301,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1301) {
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
 * 通过 CDP Input.dispatchMouseEvent 模拟鼠标悬停在指定坐标
 * 
 * @param {number} x - 视口 X 坐标
 * @param {number} y - 视口 Y 坐标
 * @param {number} port - CDP 端口
 * @returns {Promise<void>} 悬停事件派发完成后 resolve
 * @throws {Error} 连接失败或派发事件异常时抛出
 */
async function hoverAt(x, y, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1302,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x, y }
      }));
      setTimeout(() => {
        ws.close();
        resolve();
      }, 300);
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 主探查入口函数
 * 
 * @returns {Promise<void>}
 */
async function main() {
  // 获取侧边栏所有按钮及顶部返回按钮的位置与基本信息
  const getButtonsCode = `
    (() => {
      const buttons = Array.from(document.querySelectorAll('button._Button_f5tnh_2, button.button-toolbar, #application-menu-trigger-file-menu, #application-menu-trigger-edit-menu, #application-menu-trigger-view-menu, #application-menu-trigger-help-menu'));
      return buttons.map(btn => {
        const r = btn.getBoundingClientRect();
        return {
          id: btn.id,
          text: (btn.textContent || '').trim(),
          ariaLabel: btn.getAttribute('aria-label'),
          sidebarDest: btn.getAttribute('data-sidebar-destination'),
          cls: btn.className,
          rect: { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height, left: r.left, top: r.top }
        };
      });
    })()
  `;

  const btnList = await evalInCodex(getButtonsCode);
  console.log(`获取到 ${btnList.length} 个候选按钮:`, btnList.map(b => b.sidebarDest || b.text || b.id || b.ariaLabel));

  // 悬停在第一个带快捷键或具体提示的侧边栏按钮上，如 home 或 library
  const targetBtn = btnList.find(b => b.sidebarDest === 'builtin:home' || b.sidebarDest === 'builtin:library') || btnList[0];
  if (targetBtn) {
    console.log(`悬停在按钮:`, targetBtn.sidebarDest || targetBtn.text, `坐标: (${targetBtn.rect.x}, ${targetBtn.rect.y})`);
    await hoverAt(targetBtn.rect.x, targetBtn.rect.y);
    await new Promise(r => setTimeout(r, 600));

    // 探查当前 DOM 中所有 tooltip 相关结构与内联快捷键样式
    const probeDetailCode = `
      (() => {
        const tooltips = Array.from(document.querySelectorAll('[role="tooltip"]'));
        return tooltips.map(tt => {
          const s = window.getComputedStyle(tt);
          const children = Array.from(tt.querySelectorAll('*')).map(c => {
            const cs = window.getComputedStyle(c);
            return {
              tag: c.tagName,
              cls: c.className,
              text: (c.textContent || '').trim(),
              bg: cs.backgroundColor,
              color: cs.color,
              border: cs.border,
              borderRadius: cs.borderRadius
            };
          });
          return {
            id: tt.id,
            cls: tt.className,
            text: (tt.textContent || '').trim(),
            bg: s.backgroundColor,
            color: s.color,
            border: s.border,
            borderRadius: s.borderRadius,
            backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
            boxShadow: s.boxShadow,
            outerHTML: tt.outerHTML,
            children
          };
        });
      })()
    `;

    const tooltips = await evalInCodex(probeDetailCode);
    console.log('=== Tooltip 内部结构与样式 ===');
    console.log(JSON.stringify(tooltips, null, 2));
  }
}

main().catch(console.error);
