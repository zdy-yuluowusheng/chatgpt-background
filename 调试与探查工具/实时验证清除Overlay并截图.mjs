/**
 * @file 实时验证清除Overlay并截图.mjs
 * @description 实时清除 .popcorn-review-bar-overlay 上的 blur 和 background，并截取当前窗口的高清屏幕图像进行验证
 * @author Antigravity
 */

import fs from 'fs';
import path from 'path';

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在目标 WebSocket 上执行指令并支持捕获截图
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
      ws.send(JSON.stringify({
        id: 1,
        method,
        params
      }));
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

  if (!mainPage) {
    console.error('未找到主窗口 index.html');
    return;
  }

  // 1. 临时注入高优先级 style 规则，清除 overlay 的 blur 和背景
  const cleanExpr = `
    (() => {
      let testStyle = document.getElementById('__test_docx_unblur__');
      if (!testStyle) {
        testStyle = document.createElement('style');
        testStyle.id = '__test_docx_unblur__';
        document.head.appendChild(testStyle);
      }
      testStyle.textContent = \`
        .popcorn-review-bar-overlay,
        .popcorn-review-bar-overlay-content,
        div[data-popcorn-review-bar="true"] {
          background-color: transparent !important;
          background: transparent !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          filter: none !important;
          -webkit-filter: none !important;
          box-shadow: none !important;
          border: none !important;
        }

        .codex-docx-preview-wrapper,
        section.codex-docx-preview,
        .codex-docx-preview,
        [data-testid="artifact-docx-comment-layer"] {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          filter: none !important;
          -webkit-filter: none !important;
        }
      \`;
      return '临时样式注入成功';
    })()
  `;

  const cleanResult = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: cleanExpr,
    returnByValue: true
  });
  console.log('注入临时去模糊样式结果:', cleanResult?.result?.value);

  // 2. 截取整个页面截图
  const screenshotResult = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png'
  });

  if (screenshotResult?.data) {
    const savePath = 'd:\\work\\chatgpt-background\\调试与探查工具\\验收_清除Overlay后docx预览效果.png';
    fs.writeFileSync(savePath, Buffer.from(screenshotResult.data, 'base64'));
    console.log(`截图已保存至: ${savePath}`);
  } else {
    console.error('截图失败，无数据返回');
  }
}

main().catch(console.error);
