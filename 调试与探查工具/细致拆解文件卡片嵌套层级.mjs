/**
 * @file 细致拆解文件卡片嵌套层级.mjs
 * @description 细致打印包含“围串标检测系统测试报告.docx”卡片的所有父级、直接子级，分析外部大框与内部小框分别由哪些元素产生
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

  const analyzeExpr = `
    (() => {
      const docxEl = Array.from(document.querySelectorAll('*')).find(el => 
        el.children.length === 0 && (el.innerText || '').includes('围串标检测系统测试报告.docx')
      );
      if (!docxEl) return { error: '未找到 docx 元素' };

      // 向上获取所有祖先
      const chain = [];
      let cur = docxEl;
      while (cur && cur !== document.body) {
        const cs = window.getComputedStyle(cur);
        const r = cur.getBoundingClientRect();
        chain.push({
          tag: cur.tagName.toLowerCase(),
          className: cur.className,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          border: cs.border,
          borderRadius: cs.borderRadius,
          bg: cs.backgroundColor,
          bdf: cs.backdropFilter,
          overflow: cs.overflow
        });
        cur = cur.parentElement;
      }

      return {
        chain: chain.slice(0, 10)
      };
    })()
  `;

  const data = await evaluateOnTarget(mainPage.webSocketDebuggerUrl, analyzeExpr);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
