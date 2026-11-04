/**
 * @file 深入导出DocxPreview容器HTML与样式.mjs
 * @description 获取包含 .codex-docx-preview-wrapper 的完整 DOM 树与所有子节点的类名、样式与内联 style
 * @author Antigravity
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在目标 WebSocket 上执行表达式
 * 
 * @param {string} wsUrl - WebSocket URL
 * @param {string} expr - JavaScript 表达式
 * @returns {Promise<any>} 执行结果
 * @throws {Error} 通信失败或超时
 */
function evaluateOnTarget(wsUrl, expr) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('CDP evaluate 超时'));
    }, 8000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        clearTimeout(timeout);
        ws.close();
        resolve(data.result?.result?.value);
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        reject(err);
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
  const targets = await res.json();
  const mainPage = targets.find(t => t.type === 'page' && t.url.includes('index.html'));

  const dumpExpr = `
    (() => {
      // 查找包含 codex-docx-preview-wrapper 的元素
      const target = document.querySelector('.codex-docx-preview-wrapper') || 
        Array.from(document.querySelectorAll('*')).find(el => (el.innerHTML || '').includes('codex-docx-preview-wrapper'));

      if (!target) {
        return { error: '未找到 codex-docx-preview-wrapper' };
      }

      // 获取 target 自身以及父级的链条
      const hierarchy = [];
      let cur = target;
      while (cur && cur !== document.body) {
        const cs = window.getComputedStyle(cur);
        hierarchy.push({
          tag: cur.tagName.toLowerCase(),
          className: cur.className,
          id: cur.id,
          style: cur.getAttribute('style'),
          filter: cs.filter,
          bdf: cs.backdropFilter || cs.webkitBackdropFilter,
          bg: cs.backgroundColor,
          opacity: cs.opacity
        });
        cur = cur.parentElement;
      }

      // 提取 target 内部的所有节点
      const subNodes = Array.from(target.querySelectorAll('*')).map(el => {
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          className: String(el.className).substring(0, 80),
          id: el.id,
          filter: cs.filter,
          bdf: cs.backdropFilter || cs.webkitBackdropFilter,
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          styleAttr: el.getAttribute('style')
        };
      });

      return {
        targetHTML: target.outerHTML.substring(0, 1500),
        hierarchy,
        subNodesCount: subNodes.length,
        subNodesWithFilterOrBdf: subNodes.filter(n => (n.filter && n.filter !== 'none') || (n.bdf && n.bdf !== 'none')),
        firstTenSubNodes: subNodes.slice(0, 10)
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, dumpExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
