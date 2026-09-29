/**
 * @file 深入探查设置卡片与图标Hover.mjs
 * @description 精确探测设置详情内的分组卡片节点（权限、常规等），以及侧边栏图标的 hover 和 active 选择器与样式
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
        id: 3001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 3001) {
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
 * 探查设置详情卡片与侧边栏图标详情
 * 
 * @returns {Promise<void>}
 */
async function main() {
  const script = `
    (() => {
      const results = {};

      // 1. 精确查找“权限”和“常规”两个分组卡片
      // 文本包含“默认权限”并且包含“完整访问权限”的容器，找最深的一层卡片
      const permTitle = Array.from(document.querySelectorAll('*')).find(el => (el.textContent || '').trim() === '默认权限');
      if (permTitle) {
        let el = permTitle.parentElement;
        const chain = [];
        while (el && el.offsetHeight < 500) {
          const style = window.getComputedStyle(el);
          chain.push({
            tag: el.tagName,
            cls: el.className,
            bg: style.backgroundColor,
            borderRadius: style.borderRadius,
            border: style.border,
            boxShadow: style.boxShadow,
            w: el.offsetWidth,
            h: el.offsetHeight
          });
          el = el.parentElement;
        }
        results.permCardChain = chain;
      }

      // 2. 检查设置右侧面板的所有带背景的元素
      const settingsRightContent = document.querySelector('div.flex-1.scrollbar-stable.overflow-y-auto') || document.querySelector('div[class*="_content_6317u_2"]')?.parentElement;
      if (settingsRightContent) {
        const bgElements = [];
        settingsRightContent.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            bgElements.push({
              tag: el.tagName,
              cls: el.className,
              bg: bg,
              borderRadius: style.borderRadius,
              border: style.border,
              textSnippet: (el.textContent || '').trim().slice(0, 40),
              w: el.offsetWidth,
              h: el.offsetHeight
            });
          }
        });
        results.settingsRightBgElements = bgElements;
      }

      // 3. 探查侧边栏图标按钮（第一个 Home 图标、历史图标等）
      // 寻找 data-sidebar-destination="builtin:home" 的按钮及其外层
      const homeBtn = document.querySelector('button[data-sidebar-destination="builtin:home"]');
      if (homeBtn) {
        const style = window.getComputedStyle(homeBtn);
        results.homeBtn = {
          tag: homeBtn.tagName,
          cls: homeBtn.className,
          bg: style.backgroundColor,
          color: style.color,
          dataset: Object.assign({}, homeBtn.dataset),
          parentCls: homeBtn.parentElement ? homeBtn.parentElement.className : '',
          // 获取所有内联或 CSS 匹配的规则（通过直接读取相关属性）
          outerHTML: homeBtn.outerHTML.slice(0, 300)
        };
      }

      // 4. 探查左侧设置项列表当前选中项（如“常规”项是选中的）
      const activeSettingItem = document.querySelector('button.sidebar-item[data-state="open"], button.sidebar-item[aria-selected="true"], button.sidebar-item.bg-primary-ghost-hover, button.sidebar-item:has(span)');
      const allSettingNavButtons = Array.from(document.querySelectorAll('button.sidebar-item'));
      results.settingNavButtons = allSettingNavButtons.slice(0, 5).map(btn => {
        const style = window.getComputedStyle(btn);
        return {
          text: (btn.textContent || '').trim(),
          cls: btn.className,
          bg: style.backgroundColor,
          dataset: Object.assign({}, btn.dataset),
          attributes: Array.from(btn.attributes).map(a => a.name + '=' + a.value)
        };
      });

      return results;
    })()
  `;

  const data = await evalInCodex(script);
  console.log('=== 设置卡片探查 ===');
  console.log('权限卡片链:', JSON.stringify(data.permCardChain, null, 2));
  console.log('\n设置详情右侧所有带背景的元素:');
  data.settingsRightBgElements?.forEach((el, i) => {
    console.log(`[${i}] <${el.tag} class="${el.cls}"> bg: ${el.bg}, radius: ${el.borderRadius}, text: ${el.textSnippet}`);
  });
  console.log('\nHome 按钮详情:', JSON.stringify(data.homeBtn, null, 2));
  console.log('\n设置侧边导航按钮前5项:', JSON.stringify(data.settingNavButtons, null, 2));
}

main().catch(console.error);
