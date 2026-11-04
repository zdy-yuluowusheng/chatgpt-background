/**
 * @file 验证单层透明框效果.mjs
 * @description 临时注入 CSS 消除内部小框边框，仅保留外部大透明框，并截取特写图进行视觉比对
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

  const injectExpr = `
    (() => {
      let testStyle = document.getElementById('__test_single_border_fix__');
      if (!testStyle) {
        testStyle = document.createElement('style');
        testStyle.id = '__test_single_border_fix__';
        document.head.appendChild(testStyle);
      }

      testStyle.textContent = \`
        /* 内部资源卡片彻底消除边框，只保留外部大框 */
        [class*="group/resource-card"],
        div.group\\\\/resource-card,
        [class*="group/resource-card"][class*="bg-primary-soft"] {
          border: none !important;
          border-width: 0 !important;
          border-color: transparent !important;
          border-radius: inherit !important;
          box-shadow: none !important;
          background: transparent !important;
          background-color: transparent !important;
        }

        /* 鼠标悬停时轻微微光，不产生边框 */
        [class*="group/resource-card"]:hover,
        [class*="group/resource-card"]:has(button:hover) {
          border: none !important;
          border-width: 0 !important;
          border-color: transparent !important;
          background: rgba(255, 255, 255, 0.05) !important;
          background-color: rgba(255, 255, 255, 0.05) !important;
        }

        /* 外部大透明框保持统一的 14px 圆角与微光外边框 */
        div:has(> [class*="group/resource-card"]),
        div[class*="bg-surface-elevated-secondary"]:has([class*="group/resource-card"]) {
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          border-radius: 14px !important;
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
        }
      \`;

      return '测试样式注入成功';
    })()
  `;

  await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: injectExpr,
    returnByValue: true
  });

  // 截取特写图
  const clipScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 390,
      y: 480,
      width: 780,
      height: 260,
      scale: 1
    }
  });

  if (clipScreenshot?.data) {
    const savePath = 'd:\\work\\chatgpt-background\\调试与探查工具\\单层透明框效果特写.png';
    fs.writeFileSync(savePath, Buffer.from(clipScreenshot.data, 'base64'));
    console.log(`特写图已保存至: ${savePath}`);
  }
}

main().catch(console.error);
