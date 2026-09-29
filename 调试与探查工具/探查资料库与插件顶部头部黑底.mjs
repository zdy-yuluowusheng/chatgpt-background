/**
 * @file 探查资料库与插件顶部头部黑底.mjs
 * @description 依次点击资料库与插件菜单，探查页面顶部头部区域带有深色/黑底背景的 DOM 节点与其 CSS 类名、计算样式
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
        id: 2101,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2101) {
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
  // 1. 探查资料库 (Library) 页面
  console.log('1. 切换至“资料库”并探查顶部黑底节点...');
  await evalInCodex(`
    (() => {
      const libBtn = document.querySelector('button[data-sidebar-destination="builtin:library"]');
      if (libBtn) libBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  const probeLibraryCode = `
    (() => {
      const results = [];
      // 遍历所有包含“资料库”大标题、搜索框或顶栏的容器
      const h1s = Array.from(document.querySelectorAll('h1, h2, header, div')).filter(el => {
        return (el.textContent || '').trim().startsWith('资料库') && el.offsetWidth > 300;
      });
      
      // 检查视口顶部 0 到 300px 范围内的所有非透明背景元素
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 250 && rect.width > 300 && rect.height > 30) {
          const s = window.getComputedStyle(el);
          const bg = s.backgroundColor;
          const bgImg = s.backgroundImage;
          // 查找非透明深色背景
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            results.push({
              tag: el.tagName,
              cls: el.className,
              id: el.id,
              bg,
              bgImg: bgImg !== 'none' ? bgImg.slice(0, 50) : 'none',
              rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              outerHTMLSnippet: el.outerHTML.slice(0, 200)
            });
          }
        }
      });
      return results;
    })()
  `;
  const libResults = await evalInCodex(probeLibraryCode);
  console.log('=== 资料库顶部深色背景节点 ===');
  console.log(JSON.stringify(libResults, null, 2));

  // 2. 探查插件 (Customize) 页面
  console.log('2. 切换至“插件/Customize”并探查顶部黑底节点...');
  await evalInCodex(`
    (() => {
      const customBtn = document.querySelector('button[data-sidebar-destination="builtin:customize"]');
      if (customBtn) customBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  const probeCustomCode = `
    (() => {
      const results = [];
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 250 && rect.width > 300 && rect.height > 30) {
          const s = window.getComputedStyle(el);
          const bg = s.backgroundColor;
          const bgImg = s.backgroundImage;
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            results.push({
              tag: el.tagName,
              cls: el.className,
              id: el.id,
              bg,
              bgImg: bgImg !== 'none' ? bgImg.slice(0, 50) : 'none',
              rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
              outerHTMLSnippet: el.outerHTML.slice(0, 200)
            });
          }
        }
      });
      return results;
    })()
  `;
  const customResults = await evalInCodex(probeCustomCode);
  console.log('=== 插件顶部深色背景节点 ===');
  console.log(JSON.stringify(customResults, null, 2));
}

main().catch(console.error);
