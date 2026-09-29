/**
 * @file 探查新建添加主按钮样式.mjs
 * @description 探查资料库与插件中“新建”和“添加”等主操作按钮的原生文字颜色与背景，以制定最完美的微光搭配
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
        id: 2701,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2701) {
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
  const code = `
    (() => {
      const btns = Array.from(document.querySelectorAll('button.bg-primary-solid, button[class*="bg-primary-solid"]')).map(btn => {
        const s = window.getComputedStyle(btn);
        return {
          text: (btn.textContent || '').trim(),
          cls: btn.className,
          bg: s.backgroundColor,
          color: s.color
        };
      });
      return btns;
    })()
  `;
  const info = await evalInCodex(code);
  console.log('主操作按钮计算样式:', JSON.stringify(info, null, 2));
}

main().catch(console.error);
