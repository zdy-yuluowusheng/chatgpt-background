/**
 * @file 探查侧边栏图标与个人菜单.mjs
 * @description 获取侧边栏图标的原生按钮样式规则，并触发个人资料菜单展开后探查其浮层结构
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
        id: 5001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 5001) {
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
 * 主逻辑：查找按钮相关样式并在页面中触发个人菜单弹出
 * 
 * @returns {Promise<void>}
 */
async function main() {
  const findRulesCode = `
    (() => {
      const rules = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const sel = rule.selectorText || '';
            if (sel.includes('_Button_f5tnh_2') && (sel.includes(':hover') || sel.includes(':active') || sel.includes('data-active') || sel.includes('data-state') || sel.includes('data-variant'))) {
              rules.push({ selector: sel, css: rule.cssText });
            }
          }
        } catch {}
      }
      return rules;
    })()
  `;

  const rules = await evalInCodex(findRulesCode);
  console.log('=== 原生 _Button_f5tnh_2 相关规则 ===');
  rules.forEach((r, i) => {
    console.log(`[${i}] ${r.selector}`);
    console.log(`     ${r.css}\n`);
  });

  // 现在模拟点击头像打开个人菜单并探测 DOM
  const openProfileMenuCode = `
    (() => {
      const profileBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (profileBtn) {
        profileBtn.click();
        return true;
      }
      return false;
    })()
  `;
  const clicked = await evalInCodex(openProfileMenuCode);
  console.log('点击个人菜单按钮结果:', clicked);

  // 等待 500ms 后探测弹出的菜单
  await new Promise(r => setTimeout(r, 500));

  const probeMenuCode = `
    (() => {
      const menus = [];
      document.querySelectorAll('[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper], [class*="popover"], [data-state="open"]').forEach(el => {
        if (el.tagName !== 'BUTTON' && el.offsetHeight > 40) {
          const style = window.getComputedStyle(el);
          menus.push({
            tag: el.tagName,
            cls: el.className,
            role: el.getAttribute('role'),
            dataState: el.getAttribute('data-state'),
            bg: style.backgroundColor,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
            border: style.border,
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            rect: { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight },
            outerHTMLSnippet: el.outerHTML.slice(0, 300)
          });
        }
      });
      return menus;
    })()
  `;

  const menus = await evalInCodex(probeMenuCode);
  console.log('\n=== 探测到的弹窗/浮动菜单 ===');
  console.log(JSON.stringify(menus, null, 2));
}

main().catch(console.error);
