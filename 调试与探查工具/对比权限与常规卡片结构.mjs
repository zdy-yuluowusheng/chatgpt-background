/**
 * @file 对比权限与常规卡片结构.mjs
 * @description 对比权限卡片与常规卡片的 DOM 标签、类名与层级结构，找出差异
 */

/**
 * 在目标页面执行 JavaScript 脚本并获取结果
 * 
 * @param {string} expr - JavaScript 表达式
 * @param {number} port - 端口号
 * @returns {Promise<any>}
 * @throws {Error}
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
        id: 9951,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9951) {
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
 * 主逻辑
 */
async function main() {
  const code = `
    (() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      
      // 找包含“默认权限”的父级卡片
      const permItem = allEls.find(el => (el.textContent || '').includes('默认权限') && el.className.includes('settings-row'));
      const permCard = permItem ? permItem.parentElement : null;

      // 找包含“无项目任务文件夹”的父级卡片
      const generalItem = allEls.find(el => (el.textContent || '').includes('无项目任务文件夹') && (el.className.includes('settings-row') || el.children.length >= 2));
      let generalCard = generalItem;
      while (generalCard && !generalCard.className.includes('rounded-2xl') && generalCard !== document.body) {
        generalCard = generalCard.parentElement;
      }

      const getCardInfo = (c, name) => {
        if (!c) return { error: name + ' 未找到' };
        const s = window.getComputedStyle(c);
        return {
          name,
          tag: c.tagName,
          cls: c.className,
          bg: s.backgroundColor,
          parentTag: c.parentElement ? c.parentElement.tagName : null,
          parentCls: c.parentElement ? c.parentElement.className : null,
          grandParentTag: c.parentElement?.parentElement?.tagName,
          grandParentCls: c.parentElement?.parentElement?.className,
          w: c.offsetWidth,
          h: c.offsetHeight
        };
      };

      return {
        permCard: getCardInfo(permCard, 'permCard'),
        generalCard: getCardInfo(generalCard, 'generalCard')
      };
    })()
  `;

  const res = await evalInCodex(code);
  console.log('=== 卡片结构对比 ===');
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
