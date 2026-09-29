/**
 * @file 探查设置界面与侧边栏DOM.mjs
 * @description 通过 CDP 探测当前界面的设置详情区与左侧任务栏图标的 DOM 结构、类名与计算样式
 */

/**
 * 执行 CDP 远程代码执行并返回求值结果
 * 
 * @param {string} expr - 需要在页面内求值的 JavaScript 表达式
 * @param {number} port - CDP 调试端口号
 * @returns {Promise<any>} 返回求值结果的数据内容
 * @throws {Error} 网络连接失败或求值过程出现异常时抛出
 */
async function evaluateInPage(expr, port = 9335) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const target = targets.find(t => t.url && t.url.includes('app://-/index.html') && !t.url.includes('initialRoute'));
  if (!target) {
    throw new Error('未找到主页面');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1001,
        method: 'Runtime.evaluate',
        params: {
          expression: expr,
          returnByValue: true,
          awaitPromise: true
        }
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1001) {
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
 * 探查当前页面的设置区域与侧边栏元素
 * 
 * @returns {Promise<void>}
 * @throws {Error} 探查失败时抛出错误
 */
async function inspectSettingsAndSidebar() {
  const probeScript = `
    (() => {
      const results = {};

      // 1. 探查设置界面（图二）相关容器
      const allDivs = Array.from(document.querySelectorAll('*'));
      
      // 寻找含有“常规”或设置相关文本的节点
      const settingsContainers = [];
      document.querySelectorAll('div, section, main, [role="dialog"], [class*="setting"], [class*="Setting"]').forEach(el => {
        const text = el.textContent || '';
        if (text.includes('常规') && text.includes('权限') && el.children.length > 0) {
          const style = window.getComputedStyle(el);
          settingsContainers.push({
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            attributes: Array.from(el.attributes).map(a => a.name + '=' + a.value),
            bg: style.backgroundColor,
            bgImg: style.backgroundImage,
            boxShadow: style.boxShadow,
            backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
            width: el.offsetWidth,
            height: el.offsetHeight
          });
        }
      });
      results.settingsContainers = settingsContainers.slice(0, 10);

      // 2. 探查设置详情右侧的具体卡片（如“权限”、“常规”卡片）
      const cards = [];
      document.querySelectorAll('*').forEach(el => {
        if ((el.textContent.includes('默认权限') || el.textContent.includes('无项目任务文件夹')) && el.offsetHeight > 40 && el.offsetHeight < 600 && el.offsetWidth > 300) {
          const style = window.getComputedStyle(el);
          cards.push({
            tagName: el.tagName,
            className: el.className,
            bg: style.backgroundColor,
            borderRadius: style.borderRadius,
            border: style.border,
            outerHTMLSnippet: el.outerHTML.slice(0, 150)
          });
        }
      });
      results.cards = cards.slice(0, 8);

      // 3. 探查左侧任务栏（侧边导航轨）图标
      const sidebarIcons = [];
      const rail = document.querySelector('nav, aside, [class*="rail"], [class*="sidebar"], [data-app-shell-sidebar-root]');
      document.querySelectorAll('button, a, [role="button"]').forEach(btn => {
        const rect = btn.getBoundingClientRect();
        // 位于左侧窄栏（例如 x < 80）
        if (rect.left < 80 && rect.width < 70 && rect.height > 20 && rect.height < 70) {
          const style = window.getComputedStyle(btn);
          sidebarIcons.push({
            tagName: btn.tagName,
            className: btn.className,
            ariaLabel: btn.getAttribute('aria-label'),
            title: btn.getAttribute('title'),
            id: btn.id,
            dataset: Object.assign({}, btn.dataset),
            bg: style.backgroundColor,
            borderRadius: style.borderRadius,
            rect: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
            parentClass: btn.parentElement ? btn.parentElement.className : '',
            outerSnippet: btn.outerHTML.slice(0, 150)
          });
        }
      });
      results.sidebarIcons = sidebarIcons;

      // 4. 查看当前是否有打开的弹出层（如个人菜单 popover）
      const popovers = [];
      document.querySelectorAll('[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper], [class*="popover"], [class*="menu"]').forEach(pop => {
        const style = window.getComputedStyle(pop);
        if (style.display !== 'none' && style.visibility !== 'hidden' && pop.offsetHeight > 20) {
          popovers.push({
            tagName: pop.tagName,
            className: pop.className,
            role: pop.getAttribute('role'),
            bg: style.backgroundColor,
            backdropFilter: style.backdropFilter,
            rect: pop.getBoundingClientRect()
          });
        }
      });
      results.popovers = popovers;

      return results;
    })()
  `;

  const info = await evaluateInPage(probeScript);
  console.log('=== 探查结果 ===');
  console.log(JSON.stringify(info, null, 2));
}

inspectSettingsAndSidebar().catch(console.error);
