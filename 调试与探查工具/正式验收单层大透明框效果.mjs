/**
 * @file 正式验收单层大透明框效果.mjs
 * @description 移除所有临时测试样式标签，确认主主题热重载生效，截取文件产物区域的高清验收图
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

  // 1. 清除可能存在的临时测试样式
  const cleanupExpr = `
    (() => {
      const tempStyle = document.getElementById('__test_single_border_fix__');
      if (tempStyle) tempStyle.remove();

      // 检查主主题是否已包含最新规则
      const injected = document.getElementById('__chatgpt_codex_custom_theme_style__');
      const hasFix = injected ? injected.textContent.includes('消除内层小框边框') : false;

      // 检查当前卡片 computedStyle
      const card = document.querySelector('div.group\\\\/resource-card');
      const p = card ? card.parentElement : null;

      return {
        themeUpdated: hasFix,
        cardBorder: card ? window.getComputedStyle(card).border : null,
        parentBorder: p ? window.getComputedStyle(p).border : null
      };
    })()
  `;

  const status = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Runtime.evaluate', {
    expression: cleanupExpr,
    returnByValue: true
  });
  console.log('正式状态检查:', JSON.stringify(status?.result?.value, null, 2));

  // 2. 截取正式验收全景与特写图
  const clipScreenshot = await sendCdpCommand(mainPage.webSocketDebuggerUrl, 'Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: 390,
      y: 100,
      width: 780,
      height: 650,
      scale: 1
    }
  });

  if (clipScreenshot?.data) {
    const savePath = 'd:\\work\\chatgpt-background\\验收_文件产物单层透明大框_正式交付.png';
    fs.writeFileSync(savePath, Buffer.from(clipScreenshot.data, 'base64'));
    console.log(`正式交付验收图已保存至: ${savePath}`);
  }
}

main().catch(console.error);
