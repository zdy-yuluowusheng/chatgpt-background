/**
 * @file 最终检验注入与预览清晰度.mjs
 * @description 检查主页面中的 custom theme style 文本，移除临时测试样式，验证 computedStyle 与无模糊渲染，并抓取全景与特写双截图
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

  if (!mainPage) {
    console.error('未找到主窗口');
    return;
  }

  // 1. 移除可能残留的临时测试样式标签与内联 style
  const cleanupExpr = `
    (() => {
      const tempStyle = document.getElementById('__test_docx_unblur__');
      if (tempStyle) tempStyle.remove();

      const overlays = document.querySelectorAll('.popcorn-review-bar-overlay, .popcorn-review-bar-overlay-content');
      overlays.forEach(el => {
        el.style.removeProperty('backdrop-filter');
        el.style.removeProperty('-webkit-backdrop-filter');
        el.style.removeProperty('background-color');
        el.style.removeProperty('background');
        el.style.removeProperty('box-shadow');
        el.style.removeProperty('border');
      });

      // 检查当前主主题 style
      const injectedTheme = document.getElementById('__chatgpt_codex_custom_theme_style__');
      const containsFix = injectedTheme ? injectedTheme.textContent.includes('保护 Word 文档自身的白底纸张') : false;

      // 检查 computedStyle
      const overlayEl = document.querySelector('.popcorn-review-bar-overlay');
      const secEl = document.querySelector('section.codex-docx-preview');

      return {
        themeContainsFix: containsFix,
        overlayComputed: overlayEl ? {
          bdf: window.getComputedStyle(overlayEl).backdropFilter,
          bg: window.getComputedStyle(overlayEl).backgroundColor,
          rect: overlayEl.getBoundingClientRect()
        } : null,
        docxComputed: secEl ? {
          bdf: window.getComputedStyle(secEl).backdropFilter,
          bg: window.getComputedStyle(secEl).backgroundColor,
          rect: secEl.getBoundingClientRect()
        } : null
      };
    })()
  `;

  const status = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: cleanupExpr,
    returnByValue: true
  });
  console.log('状态检查:', JSON.stringify(status?.result?.value, null, 2));

  // 2. 截取最终交付全景图与特写图
  const fullScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png'
  });
  if (fullScreenshot?.data) {
    const fullPath = 'd:\\work\\chatgpt-background\\验收_最终修复_全景效果.png';
    fs.writeFileSync(fullPath, Buffer.from(fullScreenshot.data, 'base64'));
    console.log(`最终全景图已保存至: ${fullPath}`);
  }

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
    const clipPath = 'd:\\work\\chatgpt-background\\验收_最终修复_正文特写.png';
    fs.writeFileSync(clipPath, Buffer.from(clipScreenshot.data, 'base64'));
    console.log(`最终特写图已保存至: ${clipPath}`);
  }
}

main().catch(console.error);
