/**
 * @file 实时测试代码块透明修复.mjs
 * @description 通过 CDP 向运行中的 ChatGPT 客户端动态注入修复后的代码块及遮罩样式，并截取当前屏幕检查修复效果。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取指定页面并注入测试 CSS 进行截图
 * 
 * @param {string} wsUrl - CDP WebSocket URL
 * @param {string} testCss - 待测试的 CSS 规则
 * @param {string} screenshotPath - 截图保存路径
 * @returns {Promise<void>} 无返回值
 * @throws {Error} CDP 通信失败时抛出异常
 */
function testCssAndCapture(wsUrl, testCss, screenshotPath) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 12000);

    ws.onopen = () => {
      // 动态向页面插入一个测试 style 节点
      const expr = `
        (() => {
          let style = document.getElementById('__test_patch_style__');
          if (!style) {
            style = document.createElement('style');
            style.id = '__test_patch_style__';
            document.head.appendChild(style);
          }
          style.textContent = ${JSON.stringify(testCss)};
          return true;
        })()
      `;

      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === 1) {
        // 样式注入完成，稍作延时并请求截图
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 500);
      } else if (data.id === 2) {
        clearTimeout(timeout);
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync(screenshotPath, Buffer.from(base64Data, 'base64'));
          console.log(`截图已保存至: ${screenshotPath}`);
        }
        ws.close();
        resolve();
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
  const list = await res.json();
  const page = list.find(t => t.type === 'page' && t.url.includes('index.html')) || list[0];
  console.log(`锁定页面: ${page.title}`);

  // 测试修复样式
  const testCss = `
    /* 代码块根容器：支持现代 data-code-block、CodeBlock、CodeSurface、Surface 以及向下兼容 pre */
    [data-code-block],
    [data-markdown-copy="code-block"],
    [class*="CodeBlock"],
    [class*="CodeSurface"],
    [class*="Surface-"],
    pre,
    .markdown pre,
    [class*="_markdown"] pre,
    [data-testid*="code"],
    /* 容器内部所有子节点（清除背景与渐变） */
    [data-code-block] > div,
    [data-code-block] [class*="ActionBar"],
    [data-code-block] [class*="StickyActionBar"],
    [data-code-block] [class*="Source-"],
    [class*="CodeBlock"] > div,
    [class*="CodeBlock"] [class*="StickyActionBar"],
    [class*="CodeBlock"] [class*="Source-"] {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      box-shadow: none !important;
    }

    /* 代码块外边框与轻质微光 */
    [data-code-block],
    [class*="CodeBlock"],
    pre {
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 14px !important;
      overflow: hidden !important;
    }

    /* 代码块内部标题动作栏（包含语言标识与复制按钮）：底部细分隔线 */
    [data-code-block] [class*="ActionBar"],
    [data-code-block] [class*="StickyActionBar"],
    [class*="CodeBlock"] [class*="StickyActionBar"] {
      border-bottom: 1px solid rgba(255, 255, 255, 0.10) !important;
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
    }

    /* 修复代码块内部 code 标签不被行内代码规则误伤 */
    [data-code-block] code,
    [class*="CodeBlock"] code,
    [class*="CodeContent"] {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
    }

    /* 消除顶部主工作区原生渐变遮罩（修复 MainContentTopFade-xxx） */
    div[class*="MainContentTopFade"],
    .MainContentTopFade,
    .app-shell-main-content-top-fade {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  await testCssAndCapture(page.webSocketDebuggerUrl, testCss, 'd:/work/chatgpt-background/调试与探查工具/测试代码块修复后截屏.png');
}

main();
