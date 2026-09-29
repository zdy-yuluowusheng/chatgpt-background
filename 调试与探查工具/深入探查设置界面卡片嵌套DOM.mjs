/**
 * @file 深入探查设置界面卡片嵌套DOM.mjs
 * @description 精确分析设置详情中“权限”和“常规”卡片的各层 DOM 节点与类名，杜绝选择器误伤
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
        id: 9901,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9901) {
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
      // 找到“权限”这行文字
      const allEls = Array.from(document.querySelectorAll('*'));
      const permHeader = allEls.find(el => (el.textContent || '').trim() === '权限' && el.children.length === 0);
      
      // 找到包含“默认权限”的 row
      const defaultPermRow = allEls.find(el => (el.textContent || '').includes('默认权限') && el.className.includes('settings-row'));

      const getHierarchy = (el) => {
        const list = [];
        let cur = el;
        while (cur && cur !== document.body) {
          list.push({
            tag: cur.tagName,
            cls: cur.className,
            childrenCount: cur.children.length,
            w: cur.offsetWidth,
            h: cur.offsetHeight,
            id: cur.id
          });
          cur = cur.parentElement;
        }
        return list;
      };

      return {
        permHeaderHierarchy: permHeader ? getHierarchy(permHeader) : null,
        defaultPermRowHierarchy: defaultPermRow ? getHierarchy(defaultPermRow) : null
      };
    })()
  `;

  const res = await evalInCodex(code);
  console.log('=== 权限标题的层级 ===');
  console.log(JSON.stringify(res.permHeaderHierarchy?.slice(0, 6), null, 2));

  console.log('\n=== 默认权限行(settings-row)的层级 ===');
  console.log(JSON.stringify(res.defaultPermRowHierarchy?.slice(0, 6), null, 2));
}

main().catch(console.error);
