/**
 * @file 验证插件页面shell伪元素.mjs
 * @description 验证插件 (Customize) 页面中顶部 _shell_6317u_ 容器是否同样具备深色 ::before 伪元素黑底
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
        id: 2401,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2401) {
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
 * 主执行流程
 * 
 * @returns {Promise<void>}
 */
async function main() {
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  const probeCode = `
    (() => {
      const shell = document.querySelector('div[class*="_shell_6317u_"]');
      if (!shell) return { found: false };
      const s = window.getComputedStyle(shell);
      const before = window.getComputedStyle(shell, '::before');
      const after = window.getComputedStyle(shell, '::after');
      return {
        found: true,
        shellCls: shell.className,
        bg: s.backgroundColor,
        beforeContent: before.content,
        beforeBg: before.backgroundColor,
        beforeBackdropFilter: before.backdropFilter,
        afterContent: after.content,
        afterBg: after.backgroundColor
      };
    })()
  `;

  const res = await evalInCodex(probeCode);
  console.log('插件页面 shell 探查结果:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
