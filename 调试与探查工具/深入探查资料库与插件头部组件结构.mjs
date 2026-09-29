/**
 * @file 深入探查资料库与插件头部组件结构.mjs
 * @description 探查 _shell_6317u_ 内部的输入框、分类胶囊与按钮样式，确保消除黑底后整体和谐美观
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 在目标页面执行 JavaScript 脚本并获取结果
 * 
 * @param {string} expr - JavaScript 表达式
 * @param {number} port - 端口号
 * @returns {Promise<any>} 返回表达式计算结果
 * @throws {Error} 连接失败或执行抛出异常时抛出错误
 */
async function evalInCodex(expr, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  if (!target) throw new Error('未找到主窗口');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 2501,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2501) {
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
 * 主函数
 */
async function main() {
  const probeShellDetail = `
    (() => {
      const shell = document.querySelector('div[class*="_shell_6317u_"]');
      if (!shell) return { error: '未找到 shell' };

      const subElements = Array.from(shell.querySelectorAll('button, input, [role="tab"], [role="search"], div')).map(el => {
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          cls: el.className,
          text: (el.textContent || el.placeholder || '').trim().slice(0, 30),
          bg: s.backgroundColor,
          border: s.border,
          boxShadow: s.boxShadow,
          backdropFilter: s.backdropFilter
        };
      }).filter(item => {
        return item.bg !== 'rgba(0, 0, 0, 0)' && item.bg !== 'transparent';
      });

      return subElements;
    })()
  `;

  // 先在插件页面查
  console.log('=== 插件页面头部非透明子元素 ===');
  const customSub = await evalInCodex(probeShellDetail);
  console.log(JSON.stringify(customSub, null, 2));

  // 切换到资料库再查
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  console.log('=== 资料库页面头部非透明子元素 ===');
  const libSub = await evalInCodex(probeShellDetail);
  console.log(JSON.stringify(libSub, null, 2));
}

main().catch(console.error);
