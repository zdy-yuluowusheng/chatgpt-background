/**
 * @file 直接内联清除Overlay验证.mjs
 * @description 通过 element.style.setProperty 强制清除 .popcorn-review-bar-overlay 的 backdrop-filter 与 background，并重新截图特写
 * @author Antigravity
 */

import fs from 'fs';

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在目标 WebSocket 上执行指令
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} method - CDP 方法名
 * @param {object} params - 参数对象
 * @returns {Promise<any>} 执行结果
 * @throws {Error} 通信失败或超时
 */
function sendCdpCommand(wsUrl, method, params = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`CDP ${method} 超时`));
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve(data.result);
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      ws.close();
      reject(err);
    };
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>} 无返回值
 */
async function main() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const targets = await res.json();
  const mainPage = targets.find(t => t.type === 'page' && t.url.includes('index.html'));

  const directCleanExpr = `
    (() => {
      const overlays = document.querySelectorAll('.popcorn-review-bar-overlay, .popcorn-review-bar-overlay-content');
      overlays.forEach(el => {
        el.style.setProperty('backdrop-filter', 'none', 'important');
        el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
        el.style.setProperty('border', 'none', 'important');
      });

      const cs = window.getComputedStyle(document.querySelector('.popcorn-review-bar-overlay'));
      return {
        bdf: cs.backdropFilter,
        bg: cs.backgroundColor
      };
    })()
  `;

  const cleanResult = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: directCleanExpr,
    returnByValue: true
  });
  console.log('直接清除后 computedStyle:', cleanResult?.result?.value);

  // 截图整个窗口
  const fullScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png'
  });
  if (fullScreenshot?.data) {
    const fullPath = 'd:\\work\\chatgpt-background\\调试与探查工具\\验收_内联清除后全景.png';
    fs.writeFileSync(fullPath, Buffer.from(fullScreenshot.data, 'base64'));
    console.log(`全景已保存至: ${fullPath}`);
  }

  // 截取右侧特写
  const clipScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 630,
      y: 180,
      width: 620,
      height: 600,
      scale: 1
    }
  });
  if (clipScreenshot?.data) {
    const savePath = 'd:\\work\\chatgpt-background\\调试与探查工具\\验收_内联清除后特写.png';
    fs.writeFileSync(savePath, Buffer.from(clipScreenshot.data, 'base64'));
    console.log(`特写已保存至: ${savePath}`);
  }
}

main().catch(console.error);
