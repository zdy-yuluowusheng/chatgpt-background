/**
 * @file 探查设置项与快捷键.mjs
 * @description 探查设置界面中所有侧边栏选项、使用情况和计费、快捷键弹窗及相关 DOM 结构与样式
 * @author Antigravity Assistant
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 9335;

/**
 * 在目标页面执行 JavaScript 脚本并获取结果
 * 
 * @param {string} expr - JavaScript 表达式
 * @param {number} port - 端口号
 * @returns {Promise<any>} 执行结果
 * @throws {Error} 执行异常或找不到页面时抛出错误
 */
async function evalInCodex(expr, port = PORT) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  if (!target) throw new Error('未找到主窗口');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1001) {
        ws.close();
        if (msg.result?.exceptionDetails) {
          reject(new Error(JSON.stringify(msg.result.exceptionDetails)));
        } else {
          resolve(msg.result?.result?.value);
        }
      }
    };
    ws.onerror = (err) => reject(err);
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>}
 * @throws {Error} 流程发生错误时抛出
 */
async function main() {
  const result = await evalInCodex(`
    (() => {
      // 查找设置界面里的按钮或侧边导航
      const buttons = Array.from(document.querySelectorAll('button, [role="tab"], [role="menuitem"], a'));
      const navItems = buttons.map(b => ({
        tag: b.tagName,
        text: b.innerText.trim(),
        role: b.getAttribute('role'),
        ariaSelected: b.getAttribute('aria-selected'),
        className: b.className
      })).filter(x => x.text.length > 0 && x.text.length < 30);

      // 查找包含“快捷键”或“使用情况”的元素
      const shortcutEls = Array.from(document.querySelectorAll('*')).filter(el => {
        return (el.textContent && el.textContent.includes('快捷键') && el.children.length === 0) ||
               (el.getAttribute('aria-label') && el.getAttribute('aria-label').includes('快捷键'));
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent,
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className,
        outerHTML: el.outerHTML.slice(0, 150)
      }));

      const billingEls = Array.from(document.querySelectorAll('*')).filter(el => {
        return (el.textContent && el.textContent.includes('使用情况') && el.children.length === 0) ||
               (el.textContent && el.textContent.includes('计费') && el.children.length === 0);
      }).map(el => ({
        tag: el.tagName,
        text: el.textContent,
        ariaLabel: el.getAttribute('aria-label'),
        className: el.className,
        outerHTML: el.outerHTML.slice(0, 150)
      }));

      return {
        navItems: navItems.slice(0, 40),
        shortcutEls,
        billingEls,
        title: document.title,
        url: window.location.href
      };
    })()
  `);

  console.log('探查结果:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
