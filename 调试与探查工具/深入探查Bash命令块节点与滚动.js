/**
 * @file 深入探查Bash命令块节点与滚动.js
 * @description 找到包含 npm run dev:test 的 Bash 节点并检查其各祖先节点的类名与滚动容器
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 诊断 Bash 节点并滚动捕获
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function locateBashBlockAndCapture(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
          let n;
          let bashEl = null;
          while (n = walker.nextNode()) {
            if ((n.nodeValue || '').includes('npm run dev:test')) {
              bashEl = n.parentElement;
              break;
            }
          }
          if (!bashEl) return { error: '未找到 bashEl' };

          // 寻找最近的可滚动祖先容器
          let curr = bashEl;
          const chain = [];
          let scrollContainer = null;
          while (curr && curr !== document.body) {
            const s = window.getComputedStyle(curr);
            chain.push({
              tag: curr.tagName,
              cls: curr.className.substring(0, 50),
              overflow: s.overflowY,
              h: curr.getBoundingClientRect().height,
              top: curr.getBoundingClientRect().top
            });
            if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
              scrollContainer = curr;
              break;
            }
            curr = curr.parentElement;
          }

          // 将页面滚动到该元素处
          if (scrollContainer) {
            const offset = bashEl.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
            scrollContainer.scrollTop += (offset - 100);
          } else {
            bashEl.scrollIntoView();
          }

          return {
            bashRect: bashEl.getBoundingClientRect(),
            chain: chain,
            hasScrollContainer: !!scrollContainer
          };
        })()
      `;
      ws.send(JSON.stringify({ id: 1401, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 1401) {
        console.dir(d.result?.result?.value, { depth: null });
        setTimeout(() => {
          ws.send(JSON.stringify({ id: 1402, method: 'Page.captureScreenshot', params: { format: 'png', quality: 90 } }));
        }, 500);
      } else if (d.id === 1402) {
        const base64Data = d.result?.data;
        if (base64Data) {
          const outPath = path.resolve(__dirname, '渲染效果预览.png');
          fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
          console.log(`[截屏成功] 已保存至: ${outPath}`);
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

locateBashBlockAndCapture();
