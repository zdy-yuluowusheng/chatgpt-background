/**
 * @file 深入分析DocxTab与活动工作区.mjs
 * @description 获取 docxTab 元素及其父级、祖先、同级、所有工作区与面板的完整信息
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
  
  const inspectExpr = `
    (() => {
      const all = Array.from(document.querySelectorAll('*'));
      const docxTab = all.find(el => (el.innerText || '').includes('符合性评审测试报告.docx') && el.className.includes('Workspace'));
      
      let tabHierarchy = [];
      let curr = docxTab;
      while (curr && curr !== document.body) {
        const r = curr.getBoundingClientRect();
        tabHierarchy.push({
          tag: curr.tagName.toLowerCase(),
          className: String(curr.className).substring(0, 100),
          id: curr.id,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          ariaSelected: curr.getAttribute('aria-selected'),
          role: curr.getAttribute('role'),
          dataset: { ...curr.dataset }
        });
        curr = curr.parentElement;
      }

      // 找到所有带有 role="tab" 或 role="tabpanel" 的元素
      const tabsAndPanels = all.filter(el => {
        const role = el.getAttribute('role');
        return role === 'tab' || role === 'tabpanel' || el.getAttribute('data-testid')?.includes('pane');
      }).map(el => {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          role: el.getAttribute('role'),
          tag: el.tagName.toLowerCase(),
          className: String(el.className).substring(0, 80),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          text: (el.innerText || '').substring(0, 30).replace(/\\n/g, ' '),
          display: cs.display,
          filter: cs.filter,
          bdf: cs.backdropFilter,
          bg: cs.backgroundColor
        };
      });

      return {
        docxTabFound: !!docxTab,
        tabHierarchy,
        tabsAndPanels
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
