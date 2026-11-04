/**
 * @file 点击Docx标签并测试主题开关.mjs
 * @description 寻找包含“符合性评审测试报告.docx”的 Tab 标签并点击，展示右侧预览视图；
 *              随后对比在有主题和无主题（disabled）状态下的计算样式与截图，排查模糊的根源。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 切换 Tab 并对比主题开关状态
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @returns {Promise<void>} 无返回值
 * @throws {Error} 通信失败时抛出异常
 */
function switchTabAndCompare(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP 操作超时'));
    }, 15000);

    ws.onopen = () => {
      // 1. 查找包含 符合性评审测试报告.docx 的 Tab 元素并点击
      const expr = `
        (() => {
          let targetTab = null;
          // 查找所有可能的 tab 元素
          for (const el of document.querySelectorAll('*')) {
            if (el.textContent.includes('符合性评审测试报告.docx') && el.children.length <= 3) {
              targetTab = el.closest('button') || el.closest('[role=\"tab\"]') || el;
              break;
            }
          }
          if (targetTab) {
            targetTab.click();
            return { foundTab: true, tabText: targetTab.innerText };
          }
          return { foundTab: false };
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
        console.log('点击 Tab 结果:', data.result?.result?.value);
        setTimeout(() => {
          // 截取当前有主题的画面
          ws.send(JSON.stringify({
            id: 2,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 1200);
      } else if (data.id === 2) {
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync('d:/work/chatgpt-background/调试与探查工具/有主题状态截图.png', Buffer.from(base64Data, 'base64'));
          console.log('有主题状态截图已保存');
        }

        // 临时禁用主题 style 节点
        const disableStyleExpr = `
          (() => {
            const style = document.getElementById('__chatgpt_codex_custom_theme_style__');
            if (style) {
              style.disabled = true;
              return { disabled: true };
            }
            return { disabled: false };
          })()
        `;

        ws.send(JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: { expression: disableStyleExpr, returnByValue: true, awaitPromise: true }
        }));
      } else if (data.id === 3) {
        console.log('禁用主题节点结果:', data.result?.result?.value);
        setTimeout(() => {
          // 截取无主题状态的画面
          ws.send(JSON.stringify({
            id: 4,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));
        }, 800);
      } else if (data.id === 4) {
        const base64Data = data.result?.data;
        if (base64Data) {
          fs.writeFileSync('d:/work/chatgpt-background/调试与探查工具/无主题状态截图.png', Buffer.from(base64Data, 'base64'));
          console.log('无主题状态截图已保存');
        }

        // 恢复主题节点
        const restoreStyleExpr = `
          (() => {
            const style = document.getElementById('__chatgpt_codex_custom_theme_style__');
            if (style) {
              style.disabled = false;
              return { restored: true };
            }
            return { restored: false };
          })()
        `;

        ws.send(JSON.stringify({
          id: 5,
          method: 'Runtime.evaluate',
          params: { expression: restoreStyleExpr, returnByValue: true, awaitPromise: true }
        }));
      } else if (data.id === 5) {
        clearTimeout(timeout);
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
  await switchTabAndCompare(page.webSocketDebuggerUrl);
}

main();
