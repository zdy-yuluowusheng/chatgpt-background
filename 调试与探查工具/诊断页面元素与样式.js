/**
 * @file 诊断页面元素与样式.js
 * @description 通过 Chrome DevTools Protocol 诊断 ChatGPT/Codex 页面中的侧边栏及主对话区域 DOM 节点与计算样式
 */

/**
 * 执行页面 DOM 结构与计算样式诊断
 * 
 * @param {string} targetUrl - 需要诊断的目标页面 URL 标识（默认为 app://-/index.html）
 * @param {number} port - CDP 调试端口（默认为 9335）
 * @returns {Promise<void>} 诊断完成后在控制台输出分析结果
 * @throws {Error} 当无法连接到 CDP 端口或目标页面不存在时抛出异常
 */
async function diagnosePageStyles(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) {
      console.error(`[诊断错误] 未找到匹配 URL 的目标: ${targetUrl}`);
      return;
    }

    console.log(`[诊断连接] 目标页面: ${target.title} (${target.url})`);
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    ws.onopen = () => {
      // 探查脚本：1. 侧边栏结构与背景 2. 主区域和对话消息容器
      const probeScript = `
        (() => {
          // 1. 探查侧边栏相关元素
          const sidebarElements = [];
          const aside = document.querySelector('aside');
          if (aside) {
            const rect = aside.getBoundingClientRect();
            const cs = window.getComputedStyle(aside);
            sidebarElements.push({
              name: 'aside.app-shell-left-panel',
              tag: aside.tagName,
              className: aside.className,
              rect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },
              backgroundColor: cs.backgroundColor,
              backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
              opacity: cs.opacity,
              display: cs.display
            });

            // 检查 aside 内部带有背景色或非透明背景的子元素
            const allAsideChildren = aside.querySelectorAll('*');
            let coloredChildrenCount = 0;
            const coloredChildren = [];
            for (const child of allAsideChildren) {
              const childStyle = window.getComputedStyle(child);
              const bg = childStyle.backgroundColor;
              if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                coloredChildrenCount++;
                if (coloredChildren.length < 10) {
                    const childCls = typeof child.className === 'string' ? child.className : (child.className?.baseVal || '');
                    coloredChildren.push({
                      tag: child.tagName,
                      class: childCls.substring(0, 60),
                      bg: bg,
                      opacity: childStyle.opacity
                    });
                }
              }
            }
            sidebarElements.push({
              coloredChildrenTotal: coloredChildrenCount,
              sampleColoredChildren: coloredChildren
            });
          }

          // 2. 探查主对话区域与消息容器
          const mainAreaElements = [];
          const main = document.querySelector('main');
          if (main) {
            const rect = main.getBoundingClientRect();
            const cs = window.getComputedStyle(main);
            mainAreaElements.push({
              name: 'main',
              className: main.className,
              rect: { left: rect.left, top: rect.top, w: rect.width, h: rect.height },
              backgroundColor: cs.backgroundColor,
              display: cs.display,
              visibility: cs.visibility,
              opacity: cs.opacity,
              overflow: cs.overflow
            });

            // 检查 main 内部的所有直接子层级
            let curr = main;
            const hierarchy = [];
            for (let i = 0; i < 6; i++) {
              if (!curr) break;
              const s = window.getComputedStyle(curr);
              const r = curr.getBoundingClientRect();
              const cls = typeof curr.className === 'string' ? curr.className : (curr.className?.baseVal || '');
              hierarchy.push({
                level: i,
                tag: curr.tagName,
                id: curr.id,
                className: cls.substring(0, 60),
                rect: { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top) },
                display: s.display,
                visibility: s.visibility,
                opacity: s.opacity,
                bg: s.backgroundColor,
                color: s.color
              });
              curr = curr.firstElementChild;
            }
            mainAreaElements.push({ hierarchy });
          }

          // 3. 收集主区域所有可见文本及其父元素
          const mainTexts = [];
          if (main) {
            const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
              const val = node.nodeValue ? node.nodeValue.trim() : '';
              if (val.length > 0) {
                const p = node.parentElement;
                if (p) {
                  const s = window.getComputedStyle(p);
                  const r = p.getBoundingClientRect();
                  const pCls = typeof p.className === 'string' ? p.className : (p.className?.baseVal || '');
                  mainTexts.push({
                    text: val.substring(0, 50),
                    tag: p.tagName,
                    className: pCls.substring(0, 50),
                    color: s.color,
                    display: s.display,
                    visibility: s.visibility,
                    opacity: s.opacity,
                    rect: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }
                  });
                }
              }
            }
          }

          // 4. 检查是否有当前生效的主题 style 标签
          const customStyle = document.getElementById('__chatgpt_codex_custom_theme_style__');

          return {
            hasCustomStyle: !!customStyle,
            customStyleLength: customStyle ? customStyle.textContent.length : 0,
            sidebar: sidebarElements,
            mainArea: mainAreaElements,
            mainTextsCount: mainTexts.length,
            mainTextsSample: mainTexts.slice(0, 15)
          };
        })()
      `;

      ws.send(JSON.stringify({
        id: 1001,
        method: 'Runtime.evaluate',
        params: { expression: probeScript, returnByValue: true }
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === 1001) {
        if (msg.result?.exceptionDetails) {
          console.error('[执行异常]', msg.result.exceptionDetails);
        } else {
          const val = msg.result?.result?.value;
          console.log('\n===== 1. 样式注入状态 =====');
          console.log(`是否存在自定义主题样式标签: ${val.hasCustomStyle} (字符数: ${val.customStyleLength})`);

          console.log('\n===== 2. 侧边栏元素分析 =====');
          console.dir(val.sidebar, { depth: null });

          console.log('\n===== 3. 主区域层级与结构分析 =====');
          console.dir(val.mainArea, { depth: null });

          console.log(`\n===== 4. 主对话区文本节点分析 (总数: ${val.mainTextsCount}) =====`);
          console.table(val.mainTextsSample);
        }
        ws.close();
      }
    };

    ws.onerror = (err) => {
      console.error('[WebSocket 错误]', err);
    };
  } catch (error) {
    console.error('[诊断脚本执行失败]', error);
    throw error;
  }
}

diagnosePageStyles();
