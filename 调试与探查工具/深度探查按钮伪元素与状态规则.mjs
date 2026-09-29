/**
 * @file 深度探查按钮伪元素与状态规则.mjs
 * @description 获取包含 _Button_ 的所有 CSS 规则（包括 ::before, ::after, :hover, :active, [data-selected] 等）
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
        id: 9101,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9101) {
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
      const allRules = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const sel = rule.selectorText || '';
            if (sel.includes('_Button_f5tnh_2') || sel.includes('data-sidebar-destination') || sel.includes('sidebar-rail')) {
              allRules.push({
                selector: sel,
                cssText: rule.cssText
              });
            }
          }
        } catch {}
      }

      // 获取 Home 按钮 ::before 的所有计算样式属性
      const homeBtn = document.querySelector('button[data-sidebar-destination="builtin:home"]');
      let beforeDetails = {};
      let afterDetails = {};
      if (homeBtn) {
        const b = window.getComputedStyle(homeBtn, '::before');
        beforeDetails = {
          content: b.content,
          position: b.position,
          inset: b.top + ' ' + b.right + ' ' + b.bottom + ' ' + b.left,
          background: b.background,
          backgroundColor: b.backgroundColor,
          backgroundImage: b.backgroundImage,
          boxShadow: b.boxShadow,
          borderRadius: b.borderRadius,
          backdropFilter: b.backdropFilter || b.webkitBackdropFilter,
          opacity: b.opacity,
          zIndex: b.zIndex
        };
        const a = window.getComputedStyle(homeBtn, '::after');
        afterDetails = {
          content: a.content,
          position: a.position,
          background: a.background,
          backgroundColor: a.backgroundColor,
          backgroundImage: a.backgroundImage,
          boxShadow: a.boxShadow,
          borderRadius: a.borderRadius,
          opacity: a.opacity
        };
      }

      return { allRules, beforeDetails, afterDetails };
    })()
  `;

  const res = await evalInCodex(code);
  console.log('=== Home 按钮 ::before 详情 ===');
  console.log(JSON.stringify(res.beforeDetails, null, 2));

  console.log('=== Home 按钮 ::after 详情 ===');
  console.log(JSON.stringify(res.afterDetails, null, 2));

  console.log(`\n=== 找到 ${res.allRules.length} 条相关原生规则 ===`);
  res.allRules.forEach((r, i) => {
    console.log(`[Rule ${i}] ${r.selector} => ${r.cssText}`);
  });
}

main().catch(console.error);
