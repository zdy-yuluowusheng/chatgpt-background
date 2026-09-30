/**
 * @file 切换到文件预览并探查.mjs
 * @description 模拟点击第一个Tab（图组总览.html），等待渲染后探查文件预览的DOM结构、类名及背景色，并截取屏幕。
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
 * @throws {void} 捕获并返回 null
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
 * 切换到文件Tab并执行DOM探查与截图
 * 
 * @param {string} wsUrl - WebSocket URL
 * @returns {Promise<object>} 探查结果
 * @throws {Error} 异常时抛出
 */
function switchTabAndInspect(wsUrl) {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('超时'));
      }, 10000);

      ws.onopen = async () => {
        // 1. 点击第一个 tab
        const clickExpr = `
          (() => {
            const tab = document.getElementById('app-shell-tab-app-shell-tab:1');
            if (tab) {
              tab.click();
              return true;
            }
            return false;
          })()
        `;

        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: { expression: clickExpr, returnByValue: true }
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.id === 1) {
          // 等待渲染后探查
          setTimeout(() => {
            const inspectExpr = `
              (() => {
                const aside = document.querySelector('aside[data-app-shell-focus-area="right-panel"]');
                const activePanels = Array.from(document.querySelectorAll('[role="tabpanel"]:not([hidden])')).map(p => ({
                  id: p.id,
                  label: p.getAttribute('aria-label'),
                  tabId: p.getAttribute('data-tab-id'),
                  className: p.className,
                  bg: window.getComputedStyle(p).backgroundColor,
                  outerSnippet: p.outerHTML.slice(0, 1000)
                }));

                const bgElements = [];
                if (aside) {
                  aside.querySelectorAll('*').forEach(el => {
                    const s = window.getComputedStyle(el);
                    if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
                      bgElements.push({
                        tag: el.tagName.toLowerCase(),
                        id: el.id,
                        className: el.className,
                        bg: s.backgroundColor,
                        rect: { w: el.offsetWidth, h: el.offsetHeight }
                      });
                    }
                  });
                }

                return { activePanels, bgElements };
              })()
            `;

            ws.send(JSON.stringify({
              id: 2,
              method: 'Runtime.evaluate',
              params: { expression: inspectExpr, returnByValue: true }
            }));
          }, 600);
        } else if (data.id === 2) {
          // 截图
          ws.send(JSON.stringify({
            id: 3,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
          ws.panelData = data.result?.result?.value;
        } else if (data.id === 3) {
          clearTimeout(timeout);
          ws.close();
          const buffer = Buffer.from(data.result.data, 'base64');
          const outPath = path.resolve(__dirname, '../验收_文件预览切换后状态.png');
          fs.writeFileSync(outPath, buffer);
          resolve({ ...ws.panelData, screenshotPath: outPath });
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
  const res = await switchTabAndInspect(wsUrl);
  console.log('切换与探查结果:');
  console.log(JSON.stringify(res, null, 2));
}

main();
