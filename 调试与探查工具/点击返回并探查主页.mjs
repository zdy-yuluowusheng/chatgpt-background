/**
 * @file 点击返回并探查主页.mjs
 * @description 点击左上角返回按钮返回主页面，并探查侧边栏图标悬停/选中状态及个人菜单弹出层
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
        id: 6001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 6001) {
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
 * 主逻辑：点击返回或Home，并探查侧边栏与个人资料菜单
 * 
 * @returns {Promise<void>}
 */
async function main() {
  // 查找左上角返回按钮
  const backScript = `
    (() => {
      // 查找包含向左箭头的按钮
      const allButtons = Array.from(document.querySelectorAll('button'));
      const backBtn = allButtons.find(b => {
        const rect = b.getBoundingClientRect();
        return rect.left < 50 && rect.top < 30 && b.querySelector('svg');
      }) || document.querySelector('button[aria-label*="返回"], button[data-testid*="back"]');
      
      if (backBtn) {
        backBtn.click();
        return { clicked: true, tag: backBtn.tagName, cls: backBtn.className };
      }
      // 尝试点击 home 按钮
      const homeBtn = document.querySelector('button[data-sidebar-destination="builtin:home"]');
      if (homeBtn) {
        homeBtn.click();
        return { clicked: true, tag: 'home', cls: homeBtn.className };
      }
      return { clicked: false };
    })()
  `;

  const backResult = await evalInCodex(backScript);
  console.log('返回结果:', backResult);

  await new Promise(r => setTimeout(r, 600));

  // 现在探查主页状态下的侧边栏图标
  const probeRailScript = `
    (() => {
      const results = {};
      const rail = document.querySelector('nav, aside');
      const icons = [];
      document.querySelectorAll('button[data-sidebar-destination], button[data-slot="popover-trigger"], button[aria-label*="个人资料"], button[aria-label*="帮助"]').forEach(btn => {
        const style = window.getComputedStyle(btn);
        icons.push({
          dest: btn.getAttribute('data-sidebar-destination') || btn.getAttribute('aria-label') || 'popover',
          cls: btn.className,
          dataset: Object.assign({}, btn.dataset),
          bg: style.backgroundColor,
          border: style.border,
          borderRadius: style.borderRadius,
          color: style.color,
          outerHTML: btn.outerHTML.slice(0, 150)
        });
      });
      results.icons = icons;
      return results;
    })()
  `;

  const railData = await evalInCodex(probeRailScript);
  console.log('=== 侧边栏图标状态 ===');
  console.log(JSON.stringify(railData, null, 2));
}

main().catch(console.error);
