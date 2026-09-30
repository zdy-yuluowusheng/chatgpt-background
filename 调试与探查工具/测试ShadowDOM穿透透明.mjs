/**
 * @file 测试ShadowDOM穿透透明.mjs
 * @description 测试通过 CSS 变量和宿主选择器覆盖 file-tree-container 与 diffs-container 的背景。
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
 * @param {number} port - CDP 端口
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
 * 应用测试样式并检查 shadowRoot 内部元素的背景与截图
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} testCss - 样式
 * @param {string} outputPng - 输出路径
 * @returns {Promise<object>} 结果
 * @throws {Error} 异常
 */
function applyAndInspect(wsUrl, testCss, outputPng) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('超时'));
      }, 10000);

      ws.onopen = () => {
        const expr = `
          (() => {
            let el = document.getElementById('__test_sidebar_style__');
            if (!el) {
              el = document.createElement('style');
              el.id = '__test_sidebar_style__';
              document.head.appendChild(el);
            }
            el.textContent = ${JSON.stringify(testCss)};

            // 检查计算样式
            const ft = document.querySelector('file-tree-container');
            const diffs = document.querySelector('diffs-container');

            return {
              ftBg: ft ? window.getComputedStyle(ft).backgroundColor : null,
              diffsBg: diffs ? window.getComputedStyle(diffs).backgroundColor : null
            };
          })()
        `;

        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: expr, returnByValue: true }
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
  try {
    const wsUrl = await getMainPageWsUrl(PORT);
    if (!wsUrl) {
      console.error('未找到主页面 WebSocket URL');
      return;
    }

    const testCss = `
      /* 1. 右侧边栏整体根容器与面板背景透明化 */
      aside[data-app-shell-focus-area="right-panel"],
      aside[data-app-shell-focus-area="right-panel"] > div,
      [data-app-shell-pane-frame],
      [data-app-shell-tab-panel-controller="right"],
      [data-app-shell-focus-area="right-panel"] [class*="bg-[var(--app-shell-panel-background"],
      [data-app-shell-focus-area="right-panel"] [class*="bg-surface"] {
        background-color: transparent !important;
        background: transparent !important;
        --app-shell-panel-background: transparent !important;
      }

      /* 2. 局部变量覆盖：将右侧边栏内的 surface 颜色覆盖为透明，使其穿透 Web Components */
      aside[data-app-shell-focus-area="right-panel"],
      [data-app-shell-tab-panel-controller="right"],
      file-tree-container,
      diffs-container {
        --color-surface: transparent !important;
        --color-surface-secondary: transparent !important;
        --color-surface-tertiary: transparent !important;
        --trees-bg-override: transparent !important;
        --trees-item-background: transparent !important;
        --diffs-bg: transparent !important;
        --codex-diffs-surface: transparent !important;
        --codex-diffs-context-surface: transparent !important;
        --codex-diffs-header-surface: transparent !important;
        background-color: transparent !important;
        background: transparent !important;
      }

      /* 3. 头部面包屑与底部审批条透明微光美化 */
      [data-testid="viewer-header"],
      header._header_1oxlz_1,
      aside[data-app-shell-focus-area="right-panel"] header,
      aside[data-app-shell-focus-area="right-panel"] [class*="sticky"],
      aside[data-app-shell-focus-area="right-panel"] [class*="border-t"][class*="bg-surface"],
      .group\\/file-diff {
        background-color: transparent !important;
        background: transparent !important;
      }

      /* 底部操作条（编辑、拒绝、接受）胶囊美化 */
      aside[data-app-shell-focus-area="right-panel"] div:has(> button[class*="button-toolbar"]) {
        background-color: rgba(18, 22, 28, 0.40) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      }

      /* 4. 保留内置浏览器的白底/实体底色（排除内置浏览器） */
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

    const outPath = path.resolve(__dirname, '../验收_测试ShadowDOM穿透透明.png');
    await applyAndInspect(wsUrl, testCss, outPath);
    console.log(`测试完成，截图已保存到: ${outPath}`);
  } catch (err) {
    console.error('执行失败:', err);
  }
}

main();
