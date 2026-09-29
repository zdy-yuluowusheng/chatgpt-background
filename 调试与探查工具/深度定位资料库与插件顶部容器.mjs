/**
 * @file 深度定位资料库与插件顶部容器.mjs
 * @description 定位资料库与插件页面中包含标题、搜索栏与分类标签的顶部大横条容器，探查其类名、DOM层级与背景样式
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
        id: 2201,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2201) {
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
  // 1. 点击资料库
  console.log('1. 导航到资料库...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // 探查包含“资料库”三个字的元素及其各级祖先
  const probeLibAncestors = `
    (() => {
      // 找到包含文本且仅包含文本“资料库”的标题节点
      const allEls = Array.from(document.querySelectorAll('*'));
      const titleEl = allEls.find(el => {
        return (el.textContent || '').trim() === '资料库' &&
               el.children.length === 0 &&
               el.tagName !== 'BUTTON' && el.tagName !== 'SPAN' &&
               el.getBoundingClientRect().top < 150 &&
               el.getBoundingClientRect().left > 40;
      }) || allEls.find(el => (el.textContent || '').trim() === '资料库' && el.tagName === 'H1');

      if (!titleEl) return { error: '未找到资料库标题元素' };

      const chain = [];
      let curr = titleEl;
      while (curr && curr !== document.body) {
        const s = window.getComputedStyle(curr);
        const rect = curr.getBoundingClientRect();
        chain.push({
          tag: curr.tagName,
          id: curr.id,
          cls: curr.className,
          bg: s.backgroundColor,
          bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 60) : 'none',
          boxShadow: s.boxShadow,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        });
        curr = curr.parentElement;
      }
      return { titleTag: titleEl.tagName, chain };
    })()
  `;
  const libChain = await evalInCodex(probeLibAncestors);
  console.log('=== 资料库标题祖先链 ===');
  console.log(JSON.stringify(libChain, null, 2));

  // 2. 点击插件 Customize
  console.log('2. 导航到插件 Customize...');
  await evalInCodex(`
    (() => {
      const btn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      if (btn) btn.click();
      return true;
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  const probeCustomAncestors = `
    (() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      const titleEl = allEls.find(el => {
        return (el.textContent || '').trim() === '插件' &&
               el.children.length === 0 &&
               el.getBoundingClientRect().top < 150 &&
               el.getBoundingClientRect().left > 40;
      }) || allEls.find(el => (el.textContent || '').trim() === '插件' && el.tagName === 'H1');

      if (!titleEl) return { error: '未找到插件标题元素' };

      const chain = [];
      let curr = titleEl;
      while (curr && curr !== document.body) {
        const s = window.getComputedStyle(curr);
        const rect = curr.getBoundingClientRect();
        chain.push({
          tag: curr.tagName,
          id: curr.id,
          cls: curr.className,
          bg: s.backgroundColor,
          bgImg: s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 60) : 'none',
          boxShadow: s.boxShadow,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        });
        curr = curr.parentElement;
      }
      return { titleTag: titleEl.tagName, chain };
    })()
  `;
  const customChain = await evalInCodex(probeCustomAncestors);
  console.log('=== 插件标题祖先链 ===');
  console.log(JSON.stringify(customChain, null, 2));
}

main().catch(console.error);
