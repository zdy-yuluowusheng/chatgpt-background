/**
 * @file 测试右侧面板透明效果.mjs
 * @description 动态注入测试 CSS 规则，将右侧边栏各面板透明化，并实时截图验收。
 * @author Antigravity Assistant
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 获取主页面的 WebSocket URL
 * 
 * @param {number} port - 端口
 * @returns {Promise<string|null>} WebSocket URL
 * @throws {void} 捕获异常
 */
async function getMainPageWsUrl(port) {
  try {
    const res = await fetch(`http://${HOST}:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html') && !t.url.includes('initialRoute'));
    return page ? page.webSocketDebuggerUrl : null;
  } catch {
    return null;
  }
}

/**
 * 注入测试 CSS 并截图
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} testCss - 待测试的 CSS 字符串
 * @param {string} outputPng - 输出截图路径
 * @returns {Promise<string>} 输出图片路径
 * @throws {Error} 异常抛出
 */
function applyCssAndCapture(wsUrl, testCss, outputPng) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('超时'));
      }, 10000);

      ws.onopen = () => {
        const script = `
          (() => {
            let el = document.getElementById('__test_sidebar_style__');
            if (!el) {
              el = document.createElement('style');
              el.id = '__test_sidebar_style__';
              document.head.appendChild(el);
            }
            el.textContent = ${JSON.stringify(testCss)};
            return true;
          })()
        `;

        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: script, returnByValue: true }
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === 1) {
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 2,
              method: 'Page.captureScreenshot',
              params: { format: 'png' }
            }));
          }, 300);
        } else if (data.id === 2) {
          clearTimeout(timeout);
          ws.close();
          const buffer = Buffer.from(data.result.data, 'base64');
          fs.writeFileSync(outputPng, buffer);
          resolve(outputPng);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>}
 * @throws {void}
 */
async function main() {
  const wsUrl = await getMainPageWsUrl(PORT);
  if (!wsUrl) return;

  // 试验初版透明 CSS
  const testCss = `
    /* 1. 右侧边栏整体根容器与面板背景透明化 */
    aside[data-app-shell-focus-area="right-panel"],
    aside[data-app-shell-focus-area="right-panel"] > div,
    [data-app-shell-pane-frame],
    [data-app-shell-tab-panel-controller="right"],
    [data-app-shell-focus-area="right-panel"] [class*="bg-[var(--app-shell-panel-background"] {
      background-color: transparent !important;
      background: transparent !important;
    }

    /* 2. 文件预览、代码预览、Diff 与文件树透明化 */
    diffs-container,
    file-tree-container,
    [data-tab-id="diff"],
    [data-tab-id^="text-editor"],
    .group\\/file-diff,
    [data-testid="viewer-header"],
    header._header_1oxlz_1,
    aside[data-app-shell-focus-area="right-panel"] header,
    aside[data-app-shell-focus-area="right-panel"] [class*="sticky"] {
      background-color: transparent !important;
      background: transparent !important;
    }

    /* 3. 保留内置浏览器的白底/实体底色（排除内置浏览器） */
    webview,
    iframe,
    [data-codex-window-type="browser"],
    [data-tab-id*="browser"],
    [data-tab-id*="web-sandbox"],
    [role="tabpanel"]:has(webview),
    [role="tabpanel"]:has(iframe) {
      background-color: #1e1e1e !important;
    }
  `;

  const outPath = path.resolve(__dirname, '../验收_测试右侧面板初步透明.png');
  await applyCssAndCapture(wsUrl, testCss, outPath);
  console.log(`初步测试截图已生成: ${outPath}`);
}

main();
