/**
 * @file 深入探查文件产物卡片结构.mjs
 * @description 连接 CDP 定位会话中的文件产物（Word、Excel 等），提取卡片外层与内层容器的 DOM 树、类名及样式
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

  if (!mainPage) {
    console.error('未找到主窗口');
    return;
  }

  const inspectExpr = `
    (() => {
      // 查找包含 围串标检测系统测试报告.docx 或 围串标检测系统测试用例.xlsx 的元素
      const all = Array.from(document.querySelectorAll('*'));
      const fileTextEl = all.find(el => el.children.length === 0 && (el.innerText || '').includes('围串标检测系统测试报告.docx')) ||
                         all.find(el => el.children.length === 0 && (el.innerText || '').includes('围串标检测系统测试用例.xlsx'));

      if (!fileTextEl) {
        return { error: '未找到文件文本元素' };
      }

      // 向上寻找包含该文件以及“打开方式”按钮的完整外层卡片容器
      let cardRoot = fileTextEl;
      while (cardRoot && cardRoot.parentElement && cardRoot.parentElement !== document.body) {
        const text = cardRoot.parentElement.innerText || '';
        if (text.includes('打开方式') && text.includes('按参考样式生成报告')) {
          // 找到了会话 item，前一个层级就是 cardRoot
          break;
        }
        cardRoot = cardRoot.parentElement;
        if (cardRoot.innerText.includes('打开方式')) {
          // 已经包含了打开方式按钮
          const p = cardRoot.parentElement;
          if (p && !p.innerText.includes('按参考样式生成报告') && p.children.length === 1) {
            cardRoot = p;
          }
        }
      }

      // 提取 cardRoot 及其内部所有带有背景、边框、阴影或滤镜的节点
      const styledNodes = [];
      const collectStyled = (node) => {
        if (!node || node.nodeType !== 1) return;
        const cs = window.getComputedStyle(node);
        const r = node.getBoundingClientRect();
        const hasBorder = cs.borderWidth !== '0px' && cs.borderStyle !== 'none' && !cs.borderColor.includes('rgba(0, 0, 0, 0)');
        const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
        const hasBdf = cs.backdropFilter && cs.backdropFilter !== 'none';
        const hasShadow = cs.boxShadow && cs.boxShadow !== 'none';
        
        if (hasBorder || hasBg || hasBdf || hasShadow) {
          styledNodes.push({
            tag: node.tagName.toLowerCase(),
            className: node.className,
            id: node.id,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            border: \`\${cs.borderWidth} \${cs.borderStyle} \${cs.borderColor}\`,
            borderRadius: cs.borderRadius,
            bg: cs.backgroundColor,
            bdf: cs.backdropFilter,
            boxShadow: cs.boxShadow,
            textSnippet: (node.innerText || '').substring(0, 30).replace(/\\n/g, ' ')
          });
        }

        for (const child of node.children) {
          collectStyled(child);
        }
      };

      collectStyled(cardRoot);

      return {
        cardRootTag: cardRoot.tagName.toLowerCase(),
        cardRootClass: cardRoot.className,
        cardRootRect: cardRoot.getBoundingClientRect(),
        cardRootHTML: cardRoot.outerHTML.substring(0, 2000),
        styledNodes
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, inspectExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
