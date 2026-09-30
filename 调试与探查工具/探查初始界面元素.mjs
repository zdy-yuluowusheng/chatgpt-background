/**
 * @file 探查初始界面元素.mjs
 * @description 切换到“新聊天”初始界面，排查输入框上方选择项目、分支条等所有黑色背景来源。
 */

/**
 * 获取主窗口 WebSocket 地址
 * @param {number} port 
 * @returns {Promise<string>}
 */
async function getMainTargetWs(port = 9335) {
  const res = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page' && !t.url.includes('initialRoute'));
  if (!page) throw new Error('未找到主渲染窗口');
  return page.webSocketDebuggerUrl;
}

/**
 * 主执行函数
 */
async function main() {
  const wsUrl = await getMainTargetWs();
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // 切换到新聊天
    const switchExpr = `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
        const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
        if (newChatBtn) {
          newChatBtn.click();
          return true;
        }
        return false;
      })()
    `;
    ws.send(JSON.stringify({ id: 10, method: 'Runtime.evaluate', params: { expression: switchExpr, returnByValue: true } }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 10) {
      console.log('已点击新聊天按钮:', data.result?.result?.value);
      setTimeout(() => {
        // 在新聊天页面执行探查
        const probeExpr = `
          (() => {
            const all = Array.from(document.querySelectorAll('*'));
            
            // 查找包含 Counter-Strike-Animation 或 main 或 本地 的元素
            const branchEl = all.find(el => el.textContent && el.textContent.includes('Counter-Strike-Animation') && el.children.length === 0)
                          || all.find(el => el.textContent && el.textContent.trim() === 'main' && el.children.length === 0);
            
            let branchBarHierarchy = [];
            if (branchEl) {
              let cur = branchEl;
              while (cur && cur !== document.body && branchBarHierarchy.length < 12) {
                const cs = window.getComputedStyle(cur);
                branchBarHierarchy.push({
                  tag: cur.tagName.toLowerCase(),
                  className: String(cur.className),
                  bg: cs.backgroundColor,
                  bgImg: cs.backgroundImage,
                  filter: cs.backdropFilter || cs.webkitBackdropFilter,
                  boxShadow: cs.boxShadow,
                  border: cs.border,
                  borderRadius: cs.borderRadius,
                  rect: {
                    top: Math.round(cur.getBoundingClientRect().top),
                    left: Math.round(cur.getBoundingClientRect().left),
                    width: Math.round(cur.getBoundingClientRect().width),
                    height: Math.round(cur.getBoundingClientRect().height)
                  },
                  attrs: Array.from(cur.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class=')).slice(0, 5)
                });
                cur = cur.parentElement;
              }
            }

            // 查找所有非透明元素
            const nonTransparent = [];
            for (const el of all) {
              if (el === document.body || el === document.documentElement || el.id === 'root' || el.id === 'app') continue;
              const rect = el.getBoundingClientRect();
              if (rect.width > 20 && rect.height > 10) {
                const cs = window.getComputedStyle(el);
                const bg = cs.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                  nonTransparent.push({
                    tag: el.tagName.toLowerCase(),
                    className: String(el.className).slice(0, 100),
                    rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
                    bg,
                    filter: cs.backdropFilter || cs.webkitBackdropFilter,
                    text: el.children.length === 0 ? el.textContent?.trim().slice(0, 30) : undefined,
                    attrs: Array.from(el.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class=')).slice(0, 3)
                  });
                }
              }
            }

            return {
              branchBarHierarchy,
              nonTransparent
            };
          })()
        `;
        ws.send(JSON.stringify({ id: 20, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
      }, 600);
    } else if (data.id === 20) {
      console.log('初始界面探查结果:');
      console.log(JSON.stringify(data.result?.result?.value, null, 2));
      ws.close();
    }
  };
}

main().catch(console.error);
