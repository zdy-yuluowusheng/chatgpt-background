/**
 * @file 深度探查Tooltip与顶部菜单Hover.mjs
 * @description 探查 Tooltip 气泡的 CSS 变量与结构，以及顶部标题栏“文件 编辑 视图 帮助”和返回按钮的 hover 样式
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
        id: 1201,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 1201) {
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
 * 主探查函数
 */
async function main() {
  const code = `
    (() => {
      const results = {};

      // 1. 探查顶部菜单栏按钮（文件、编辑、视图、帮助）
      const topMenuButtons = Array.from(document.querySelectorAll('#application-menu-trigger-file-menu, #application-menu-trigger-edit-menu, #application-menu-trigger-view-menu, #application-menu-trigger-help-menu'));
      results.topMenuButtons = topMenuButtons.map(btn => {
        const s = window.getComputedStyle(btn);
        return {
          id: btn.id,
          text: (btn.textContent || '').trim(),
          cls: btn.className,
          bg: s.backgroundColor,
          color: s.color,
          borderRadius: s.borderRadius
        };
      });

      // 2. 探查左上角返回按钮
      const backBtn = Array.from(document.querySelectorAll('button')).find(b => {
        const r = b.getBoundingClientRect();
        return r.left < 50 && r.top < 30 && b.querySelector('svg');
      });
      if (backBtn) {
        const s = window.getComputedStyle(backBtn);
        results.backBtn = {
          tag: backBtn.tagName,
          cls: backBtn.className,
          bg: s.backgroundColor,
          color: s.color,
          borderRadius: s.borderRadius,
          dataset: Object.assign({}, backBtn.dataset),
          parentCls: backBtn.parentElement ? backBtn.parentElement.className : ''
        };
      }

      // 3. 探查与 Tooltip 相关的所有 CSS 变量定义
      const docStyle = window.getComputedStyle(document.documentElement);
      results.tooltipVars = {
        colorBgTooltip: docStyle.getPropertyValue('--color-background-tooltip'),
        colorBorderTooltip: docStyle.getPropertyValue('--color-border-tooltip'),
        colorTextTooltip: docStyle.getPropertyValue('--color-text-tooltip'),
        shadowTooltip: docStyle.getPropertyValue('--shadow-tooltip')
      };

      return results;
    })()
  `;

  const info = await evalInCodex(code);
  console.log('=== 顶部菜单与返回按钮以及 Tooltip 变量 ===');
  console.log(JSON.stringify(info, null, 2));
}

main().catch(console.error);
