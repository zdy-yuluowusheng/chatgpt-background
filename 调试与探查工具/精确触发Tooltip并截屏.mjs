/**
 * @file 精确触发Tooltip并截屏.mjs
 * @description 结合 DOM Pointer 事件与 CDP 鼠标悬停，精确激活侧边栏图标与顶部菜单的 Tooltip 浮层，并捕获高清透明雾化效果截图
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
        id: 1601,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1601) {
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
 * 通过单个 WebSocket 连接派发移动鼠标并维持悬停，然后截屏
 * 
 * @param {number} x - 视口 X 坐标
 * @param {number} y - 视口 Y 坐标
 * @param {string} outputPath - 截图文件路径
 * @param {number} port - 端口号
 * @returns {Promise<any>}
 * @throws {Error}
 */
async function hoverAndCapture(x, y, outputPath, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      // 1. 移动到图标旁边，模拟鼠标滑入
      ws.send(JSON.stringify({
        id: 1602,
        method: 'Input.dispatchMouseEvent',
        params: { type: 'mouseMoved', x: x - 10, y: y - 10 }
      }));

      // 2. 移动到图标正中心
      setTimeout(() => {
        ws.send(JSON.stringify({
          id: 1603,
          method: 'Input.dispatchMouseEvent',
          params: { type: 'mouseMoved', x, y }
        }));
      }, 100);

      // 3. 等待 Tooltip 弹出延迟 (Radix UI 默认延迟约 700ms)
      setTimeout(() => {
        // 请求截屏
        ws.send(JSON.stringify({
          id: 1604,
          method: 'Page.captureScreenshot',
          params: { format: 'png', quality: 95 }
        }));
      }, 1000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1604) {
        const base64Data = msg.result?.data;
        if (base64Data) {
          fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
          ws.close();
          resolve(outputPath);
        } else {
          ws.close();
          reject(new Error('未收到截屏数据'));
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 主函数
 */
async function main() {
  // 1. 获取资料库按钮或者主页按钮坐标
  const getCoordsCode = `
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:library"]') ||
                  document.querySelector('button[data-sidebar-destination="builtin:home"]');
      if (!btn) return null;
      const rect = btn.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        dest: btn.getAttribute('data-sidebar-destination')
      };
    })()
  `;

  const target = await evalInCodex(getCoordsCode);
  console.log('目标按钮坐标与信息:', target);

  if (target) {
    const outImg = path.resolve(__dirname, '../验收_小图标悬停Tooltip透明雾化效果.png');
    console.log('模拟鼠标悬停并等待 Tooltip 出现截屏...');
    await hoverAndCapture(target.x, target.y, outImg);
    console.log('截图已保存至:', outImg);

    // 探查当前 DOM 中是否有出现 Tooltip
    const probeCode = `
      (() => {
        const tt = document.querySelector('[role="tooltip"]');
        if (!tt) return { found: false };
        const s = window.getComputedStyle(tt);
        return {
          found: true,
          id: tt.id,
          text: (tt.textContent || '').trim(),
          bg: s.backgroundColor,
          color: s.color,
          border: s.border,
          boxShadow: s.boxShadow,
          borderRadius: s.borderRadius,
          backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
          outerHTML: tt.outerHTML.slice(0, 300)
        };
      })()
    `;
    const probeRes = await evalInCodex(probeCode);
    console.log('Tooltip 状态与样式探查:', JSON.stringify(probeRes, null, 2));

    const brainPath = 'C:/Users/ylws/.gemini/antigravity/brain/6a73b3d3-7f1f-486c-bf44-f0ee52033fd2/验收_小图标悬停Tooltip透明雾化效果.png';
    fs.copyFileSync(outImg, brainPath);
  }
}

main().catch(console.error);
