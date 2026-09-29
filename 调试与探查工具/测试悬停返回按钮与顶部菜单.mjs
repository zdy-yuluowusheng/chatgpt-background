/**
 * @file 测试悬停返回按钮与顶部菜单.mjs
 * @description 悬停在左上角返回按钮与顶部菜单栏，探查悬停时的实际计算背景色与毛玻璃属性
 */

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
        id: 1401,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1401) {
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
        id: 1402,
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
 * 主测试函数
 * 
 * @returns {Promise<void>}
 */
async function main() {
  // 1. 查找左上角返回按钮与顶部“文件”菜单按钮坐标
  const getCoordsCode = `
    (() => {
      const backBtn = document.querySelector('button.button-toolbar.ms-3') || Array.from(document.querySelectorAll('button')).find(b => {
        const r = b.getBoundingClientRect();
        return r.left < 50 && r.top < 30 && b.querySelector('svg');
      });
      const fileMenu = document.querySelector('#application-menu-trigger-file-menu');
      
      const r1 = backBtn ? backBtn.getBoundingClientRect() : null;
      const r2 = fileMenu ? fileMenu.getBoundingClientRect() : null;
      
      return {
        backBtn: r1 ? { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2, w: r1.width, h: r1.height } : null,
        fileMenu: r2 ? { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2, w: r2.width, h: r2.height } : null
      };
    })()
  `;

  const coords = await evalInCodex(getCoordsCode);
  console.log('按钮坐标:', coords);

  if (coords.backBtn) {
    console.log('测试悬停返回按钮...');
    await hoverAt(coords.backBtn.x, coords.backBtn.y);
    await new Promise(r => setTimeout(r, 600));

    const probeHoverCode = `
      (() => {
        const backBtn = document.querySelector('button.button-toolbar.ms-3') || Array.from(document.querySelectorAll('button')).find(b => {
          const r = b.getBoundingClientRect();
          return r.left < 50 && r.top < 30 && b.querySelector('svg');
        });
        const s = window.getComputedStyle(backBtn);
        const tt = document.querySelector('[role="tooltip"]');
        return {
          backBtn: {
            bg: s.backgroundColor,
            color: s.color,
            boxShadow: s.boxShadow,
            borderRadius: s.borderRadius
          },
          tooltip: tt ? {
            text: (tt.textContent || '').trim(),
            bg: window.getComputedStyle(tt).backgroundColor,
            color: window.getComputedStyle(tt).color,
            outerHTML: tt.outerHTML
          } : null
        };
      })()
    `;
    const res = await evalInCodex(probeHoverCode);
    console.log('返回按钮悬停结果:', JSON.stringify(res, null, 2));
  }

  if (coords.fileMenu) {
    console.log('测试悬停“文件”菜单...');
    await hoverAt(coords.fileMenu.x, coords.fileMenu.y);
    await new Promise(r => setTimeout(r, 600));

    const probeFileCode = `
      (() => {
        const fileMenu = document.querySelector('#application-menu-trigger-file-menu');
        const s = window.getComputedStyle(fileMenu);
        return {
          fileMenu: {
            bg: s.backgroundColor,
            color: s.color,
            borderRadius: s.borderRadius
          }
        };
      })()
    `;
    const res2 = await evalInCodex(probeFileCode);
    console.log('文件菜单悬停结果:', JSON.stringify(res2, null, 2));
  }
}

main().catch(console.error);
