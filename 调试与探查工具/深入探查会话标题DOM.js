/**
 * @file 深入探查会话标题DOM.js
 * @description 寻找包含“定位专家模块后端接口”的节点并向上回溯其所有父节点的样式
 */

/**
 * 诊断会话标题节点及容器样式
 * 
 * @param {string} targetUrl - 目标 URL
 * @param {number} port - 端口
 * @returns {Promise<void>}
 * @throws {Error}
 */
async function inspectConversationTitleNode(targetUrl = 'app://-/index.html', port = 9335) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await listRes.json();
    const target = targets.find(t => t.url && t.url.includes(targetUrl));
    if (!target) return console.log('未找到目标');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      const expr = `
        (() => {
          // 查找包含当前会话标题文本的元素
          const allElements = document.querySelectorAll('*');
          let titleEl = null;
          for (const el of allElements) {
            if (el.children.length === 0 && (el.textContent || '').includes('定位专家模块后端接口')) {
              titleEl = el;
              break;
            }
          }
          if (!titleEl) {
            // 如果没有精确匹配，找 titlebar 里的文字
            for (const el of allElements) {
              if ((el.textContent || '').includes('定位专家') && el.children.length <= 1) {
                titleEl = el;
                break;
              }
            }
          }
          if (!titleEl) return { error: '未找到会话标题节点' };

          // 向上遍历父链
          const chain = [];
          let curr = titleEl;
          while (curr && curr !== document.documentElement) {
            const s = window.getComputedStyle(curr);
            const before = window.getComputedStyle(curr, '::before');
            const after = window.getComputedStyle(curr, '::after');
            const r = curr.getBoundingClientRect();
            chain.push({
              tag: curr.tagName,
              id: curr.id,
              cls: (typeof curr.className === 'string' ? curr.className : '').substring(0, 60),
              rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
              bg: s.backgroundColor,
              bgImg: s.backgroundImage,
              filter: s.backdropFilter || s.webkitBackdropFilter,
              shadow: s.boxShadow,
              beforeBg: before.backgroundColor !== 'rgba(0, 0, 0, 0)' || before.backgroundImage !== 'none' ? before.backgroundImage || before.backgroundColor : undefined,
              afterBg: after.backgroundColor !== 'rgba(0, 0, 0, 0)' || after.backgroundImage !== 'none' ? after.backgroundImage || after.backgroundColor : undefined
            });
            curr = curr.parentElement;
          }

          return { titleTag: titleEl.tagName, chain };
        })()
      `;
      ws.send(JSON.stringify({ id: 601, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    };

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.id === 601) {
        const val = d.result?.result?.value;
        if (val?.error) {
          console.log(val.error);
        } else {
          console.log(`回溯父链 (共 ${val.chain.length} 层):`);
          for (const item of val.chain) {
            console.log(`<${item.tag}> #${item.id} .${item.cls} rect=(${item.rect.x},${item.rect.y},${item.rect.w},${item.rect.h}) bg=${item.bg} bgImg=${item.bgImg} filter=${item.filter} shadow=${item.shadow} before=${item.beforeBg} after=${item.afterBg}`);
          }
        }
        ws.close();
      }
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

inspectConversationTitleNode();
