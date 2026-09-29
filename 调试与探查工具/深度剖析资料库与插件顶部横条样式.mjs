/**
 * @file 深度剖析资料库与插件顶部横条样式.mjs
 * @description 深入检查 _shell_6317u_2 与 _content_6317u_2 及其子节点、兄弟节点、伪元素的所有背景、阴影与遮罩
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
        id: 2301,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2301) {
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
  // 1. 切换到资料库
  console.log('1. 导航到资料库...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // 2. 深入检查 _shell_6317u_2 与相关节点的样式、伪元素、计算样式和实际匹配的 CSS 规则
  const checkStyleCode = `
    (() => {
      const shell = document.querySelector('div[class*="_shell_6317u_"]');
      if (!shell) return { error: '未找到 _shell_6317u_ 节点' };

      const getStyleInfo = (el, name) => {
        const s = window.getComputedStyle(el);
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        return {
          name,
          tag: el.tagName,
          cls: el.className,
          bg: s.backgroundColor,
          bgImg: s.backgroundImage,
          backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
          boxShadow: s.boxShadow,
          opacity: s.opacity,
          before: {
            content: before.content,
            bg: before.backgroundColor,
            bgImg: before.backgroundImage,
            backdropFilter: before.backdropFilter,
            boxShadow: before.boxShadow
          },
          after: {
            content: after.content,
            bg: after.backgroundColor,
            bgImg: after.backgroundImage,
            backdropFilter: after.backdropFilter,
            boxShadow: after.boxShadow
          }
        };
      };

      const nodes = [
        getStyleInfo(shell, 'shell'),
        getStyleInfo(shell.parentElement, 'shell.parentElement')
      ];

      // 检查 shell 的所有直接子元素
      Array.from(shell.children).forEach((child, i) => {
        nodes.push(getStyleInfo(child, 'shell.child[' + i + '] ' + child.className));
      });

      // 检查视口坐标 (600, 100) 处的实际命中元素
      const hitElement = document.elementFromPoint(600, 100);
      const hitInfo = hitElement ? getStyleInfo(hitElement, 'elementFromPoint(600, 100): ' + hitElement.tagName + '.' + hitElement.className) : null;

      // 向上寻找命中元素所有祖先的背景
      const hitAncestors = [];
      let curr = hitElement;
      while (curr && curr !== document.body) {
        const s = window.getComputedStyle(curr);
        if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none') {
          hitAncestors.push({
            tag: curr.tagName,
            cls: curr.className,
            bg: s.backgroundColor,
            bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 60) : 'none'
          });
        }
        curr = curr.parentElement;
      }

      return { nodes, hitInfo, hitAncestors };
    })()
  `;

  const info = await evalInCodex(checkStyleCode);
  console.log('=== 资料库顶部元素深度样式 ===');
  console.log(JSON.stringify(info, null, 2));
}

main().catch(console.error);
