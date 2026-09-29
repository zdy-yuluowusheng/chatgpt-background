/**
 * @file 深入探查设置界面与卡片.mjs
 * @description 深入检索当前设置界面右侧详情背景、权限/常规卡片、以及左侧栏图标类名与样式
 */

/**
 * 在主渲染进程中评估并执行 JavaScript 代码
 * 
 * @param {string} expr - 要执行的 JS 脚本字符串
 * @param {number} port - CDP 调试端口
 * @returns {Promise<any>} 执行返回值
 * @throws {Error} CDP 通信失败或评估异常
 */
async function evaluateScript(expr, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  if (!target) throw new Error('未找到主窗口');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 2001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 2001) {
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
 * 探查并格式化打印当前界面的深色背景元素与设置页面 DOM 树结构
 * 
 * @returns {Promise<void>}
 * @throws {Error} 异常时抛出
 */
async function main() {
  const code = `
    (() => {
      const results = {
        settingsPanels: [],
        cards: [],
        sidebarRail: {},
        activeOrHoverButtons: []
      };

      // 1. 寻找包含“常规”标题的设置主详情区容器
      const h1s = Array.from(document.querySelectorAll('h1, h2, h3'));
      const generalTitle = h1s.find(h => (h.textContent || '').trim() === '常规');
      if (generalTitle) {
        let parent = generalTitle.parentElement;
        const ancestors = [];
        while (parent && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          ancestors.push({
            tag: parent.tagName,
            cls: parent.className,
            id: parent.id,
            role: parent.getAttribute('role'),
            dataAttrs: Array.from(parent.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value),
            bg: style.backgroundColor,
            bgImg: style.backgroundImage,
            border: style.border,
            boxShadow: style.boxShadow,
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            w: parent.offsetWidth,
            h: parent.offsetHeight
          });
          parent = parent.parentElement;
        }
        results.settingsPanels = ancestors;
      }

      // 2. 寻找设置项卡片（例如包含“默认权限”或者“无项目任务文件夹”的圆角区域）
      document.querySelectorAll('*').forEach(el => {
        const text = el.textContent || '';
        if ((text.includes('默认权限') && text.includes('完整访问权限') && el.children.length >= 2) ||
            (text.includes('无项目任务文件夹') && text.includes('集成终端 Shell') && el.children.length >= 2)) {
          const style = window.getComputedStyle(el);
          results.cards.push({
            tag: el.tagName,
            cls: el.className,
            bg: style.backgroundColor,
            borderRadius: style.borderRadius,
            border: style.border,
            boxShadow: style.boxShadow,
            backdropFilter: style.backdropFilter,
            dataAttrs: Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name + '=' + a.value),
            w: el.offsetWidth,
            h: el.offsetHeight
          });
        }
      });

      // 3. 探查左侧整个侧边栏容器及各层级
      const sidebarRoot = document.querySelector('[data-app-shell-sidebar-root], aside.app-shell-left-panel, nav');
      if (sidebarRoot) {
        const style = window.getComputedStyle(sidebarRoot);
        results.sidebarRail = {
          tag: sidebarRoot.tagName,
          cls: sidebarRoot.className,
          bg: style.backgroundColor,
          childrenCount: sidebarRoot.children.length
        };
      }

      // 4. 探查侧边栏图标按钮当前选中/active/hover 的状态和样式
      const railButtons = document.querySelectorAll('button[data-sidebar-destination], nav button, aside button');
      railButtons.forEach(btn => {
        const style = window.getComputedStyle(btn);
        results.activeOrHoverButtons.push({
          destination: btn.getAttribute('data-sidebar-destination') || btn.getAttribute('aria-label'),
          cls: btn.className,
          dataset: Object.assign({}, btn.dataset),
          bg: style.backgroundColor,
          border: style.border,
          boxShadow: style.boxShadow,
          borderRadius: style.borderRadius
        });
      });

      return results;
    })()
  `;

  const data = await evaluateScript(code);
  console.log('=== 设置面板与卡片分析 ===');
  console.log('设置面板祖先节点链 (从近到远):');
  data.settingsPanels.forEach((p, idx) => {
    console.log(`[${idx}] <${p.tag} class="${p.cls}" id="${p.id}" role="${p.role}"> bg: ${p.bg}, w:${p.w}, h:${p.h}`);
    if (p.dataAttrs.length) console.log(`    dataAttrs: ${p.dataAttrs.join(', ')}`);
  });

  console.log('\n设置详情内的分组卡片 (如权限、常规):');
  data.cards.forEach((c, idx) => {
    console.log(`[Card ${idx}] <${c.tag} class="${c.cls}"> bg: ${c.bg}, radius: ${c.borderRadius}, border: ${c.border}`);
    if (c.dataAttrs.length) console.log(`    dataAttrs: ${c.dataAttrs.join(', ')}`);
  });

  console.log('\n侧边栏图标当前状态:');
  data.activeOrHoverButtons.forEach((b, idx) => {
    console.log(`[Btn ${idx}] ${b.destination} | dataset: ${JSON.stringify(b.dataset)} | bg: ${b.bg} | radius: ${b.borderRadius}`);
    console.log(`    cls: ${b.cls}`);
  });
}

main().catch(console.error);
