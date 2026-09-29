/**
 * @file 探查Tooltip提示气泡DOM.mjs
 * @description 模拟鼠标悬停侧边栏图标触发 Tooltip 提示浮层，探查其 DOM 标签、类名、属性与计算样式
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
        id: 1101,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1101) {
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
 * @returns {Promise<void>}
 */
async function hoverAt(x, y, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1102,
        method: 'Input.dispatchMouseEvent',
        params: {
          type: 'mouseMoved',
          x,
          y
        }
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
        id: 1103,
        method: 'Page.captureScreenshot',
        params: { format: 'png', quality: 95 }
      }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1103) {
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
  // 1. 获取书本图标（资料库 builtin:library）的坐标
  const getBtnCoordsCode = `
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (!libBtn) return null;
      const rect = libBtn.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    })()
  `;

  const coords = await evalInCodex(getBtnCoordsCode);
  console.log('资料库图标中心坐标:', coords);

  if (coords) {
    // 2. 模拟鼠标移动到图标上
    await hoverAt(coords.x, coords.y);
    console.log('已将鼠标悬停在资料库图标上，等待 Tooltip 弹出...');
    await new Promise(r => setTimeout(r, 600));

    // 3. 截屏记录当前的悬停 Tooltip 画面
    await captureScreenshot('Tooltip提示悬停截图.png');
    console.log('已保存截图: Tooltip提示悬停截图.png');

    // 4. 探查页面中新出现的浮层、tooltip 节点
    const probeTooltipCode = `
      (() => {
        const results = [];
        // 查找所有包含“资料库”的节点，或者带有 tooltip role 的节点
        document.querySelectorAll('[role="tooltip"], [data-radix-popper-content-wrapper], [data-side], [data-state="delayed-open"], [data-state="instant-open"], [class*="tooltip"], [class*="Tooltip"]').forEach(el => {
          const s = window.getComputedStyle(el);
          results.push({
            tag: el.tagName,
            cls: el.className,
            role: el.getAttribute('role'),
            id: el.id,
            dataState: el.getAttribute('data-state'),
            dataSide: el.getAttribute('data-side'),
            dataAlign: el.getAttribute('data-align'),
            bg: s.backgroundColor,
            bgImg: s.backgroundImage,
            border: s.border,
            boxShadow: s.boxShadow,
            borderRadius: s.borderRadius,
            backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
            color: s.color,
            text: (el.textContent || '').trim(),
            rect: { w: el.offsetWidth, h: el.offsetHeight, top: el.offsetTop, left: el.offsetLeft },
            outerHTMLSnippet: el.outerHTML.slice(0, 300)
          });
        });

        // 另外遍历寻找任何含有“资料库”文字的节点
        const allTextEls = [];
        document.querySelectorAll('*').forEach(el => {
          const t = (el.textContent || '').trim();
          if (t.includes('资料库') && el.offsetWidth < 200 && el.offsetHeight < 50) {
            const s = window.getComputedStyle(el);
            allTextEls.push({
              tag: el.tagName,
              cls: el.className,
              bg: s.backgroundColor,
              color: s.color,
              parentCls: el.parentElement ? el.parentElement.className : '',
              parentBg: el.parentElement ? window.getComputedStyle(el.parentElement).backgroundColor : '',
              text: t,
              outerSnippet: el.outerHTML.slice(0, 200)
            });
          }
        });

        return { tooltipElements: results, allTextEls: allTextEls.slice(0, 5) };
      })()
    `;

    const probeRes = await evalInCodex(probeTooltipCode);
    console.log('=== Tooltip 探查结果 ===');
    console.log(JSON.stringify(probeRes, null, 2));
  }
}

main().catch(console.error);
