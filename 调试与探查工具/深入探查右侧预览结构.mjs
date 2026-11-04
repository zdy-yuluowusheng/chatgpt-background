/**
 * @file 深入探查右侧预览结构.mjs
 * @description 连接 CDP 探查主窗口以及 sandbox webview 的 DOM 结构与样式，特别是右侧预览区域
 * @author Antigravity
 */

const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 在指定的 WebSocket 目标上执行 JavaScript 表达式
 * 
 * @param {string} wsUrl - WebSocket 调试地址
 * @param {string} expr - 要执行的 JS 表达式
 * @returns {Promise<any>} 执行结果返回值
 * @throws {Error} 通信失败或超时异常
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
 * @throws {Error} 网络请求异常
 */
async function main() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const targets = await res.json();
  
  console.log(`当前共有 ${targets.length} 个 CDP 目标`);
  
  const mainPage = targets.find(t => t.type === 'page' && t.url.includes('index.html'));
  if (!mainPage) {
    console.error('未找到主页面 index.html');
    return;
  }
  
  console.log(`主页面 ID: ${mainPage.id}, 标题: ${mainPage.title}`);
  
  // 1. 在主页面探查右侧预览容器
  const inspectMainExpr = `
    (() => {
      const results = [];
      // 查找包含 docx 或 预览 或 符合性评审 的元素
      const all = Array.from(document.querySelectorAll('*'));
      const docxTab = all.find(el => (el.innerText || '').includes('符合性评审测试报告.docx'));
      
      // 查找所有 webview, iframe
      const embeds = all.filter(el => ['webview', 'iframe', 'embed', 'object'].includes(el.tagName.toLowerCase()))
        .map(el => {
          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            src: el.src || el.getAttribute('src'),
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            filter: cs.filter,
            bdf: cs.backdropFilter,
            opacity: cs.opacity,
            visibility: cs.visibility,
            display: cs.display
          };
        });

      // 查找右半区域 (x > 500) 带有 filter / backdropFilter / mask / opacity / background 的主要大容器
      const rightContainers = all.filter(el => {
        const r = el.getBoundingClientRect();
        return r.x > 400 && r.width > 300 && r.height > 300;
      }).map(el => {
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: String(el.className).substring(0, 80),
          id: el.id,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          filter: cs.filter,
          bdf: cs.backdropFilter || cs.webkitBackdropFilter,
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          hasChildren: el.children.length
        };
      });

      return {
        hasDocxTab: !!docxTab,
        docxTabClass: docxTab ? docxTab.className : null,
        docxTabParent: docxTab ? docxTab.parentElement?.className : null,
        embeds,
        rightContainers: rightContainers.slice(0, 15)
      };
    })()
  `;

  const mainData = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectMainExpr);
  console.log('主页面探查结果:', JSON.stringify(mainData, null, 2));

  // 2. 检查 sandbox webview 目标
  const sandboxTarget = targets.find(t => t.type === 'webview' && t.title === 'sandbox');
  if (sandboxTarget) {
    console.log(`\nFound sandbox webview target: ${sandboxTarget.id}`);
    const inspectSandboxExpr = `
      (() => {
        const csBody = window.getComputedStyle(document.body);
        const all = Array.from(document.querySelectorAll('*'));
        const blurred = all.filter(el => {
          const cs = window.getComputedStyle(el);
          const bdf = cs.backdropFilter || cs.webkitBackdropFilter || 'none';
          const f = cs.filter || cs.webkitFilter || 'none';
          return (bdf !== 'none' && bdf.includes('blur')) || (f !== 'none' && f.includes('blur'));
        }).map(el => {
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            className: String(el.className).substring(0, 80),
            id: el.id,
            bdf: cs.backdropFilter,
            filter: cs.filter,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
          };
        });

        return {
          title: document.title,
          url: location.href,
          bodyStyle: {
            bg: csBody.backgroundColor,
            filter: csBody.filter,
            bdf: csBody.backdropFilter
          },
          totalElements: all.length,
          blurred,
          sampleText: (document.body.innerText || '').substring(0, 200).replace(/\\n/g, ' ')
        };
      })()
    `;
    try {
      const sandboxData = await evaluateOnTarget(sandboxTarget.webSocketDebuggerUrl, inspectSandboxExpr);
      console.log('Sandbox 探查结果:', JSON.stringify(sandboxData, null, 2));
    } catch (e) {
      console.error('探查 Sandbox 失败:', e.message);
    }
  }
}

main().catch(console.error);
