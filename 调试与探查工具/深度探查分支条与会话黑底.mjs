/**
 * @file 深度探查分支条与会话黑底.mjs
 * @description 深度探查在 home 与 thread 模式下，分支/项目栏容器、额度 banner 容器以及整个底部的黑色背景来源。
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
    const probeExpr = `
      (() => {
        // 查找所有不透明或有背景色的元素（排除 body, html, #root, #app）
        const all = Array.from(document.querySelectorAll('*'));
        
        // 1. 查找包含 Counter-Strike-Animation / main / 本地 的那个条
        const projectEl = all.find(el => el.textContent && el.textContent.includes('Counter-Strike-Animation') && el.children.length === 0);
        let projectBarDetails = [];
        if (projectEl) {
          let cur = projectEl;
          while (cur && cur !== document.body) {
            const cs = window.getComputedStyle(cur);
            projectBarDetails.push({
              tag: cur.tagName.toLowerCase(),
              className: String(cur.className),
              bg: cs.backgroundColor,
              bgImg: cs.backgroundImage,
              filter: cs.backdropFilter || cs.webkitBackdropFilter,
              boxShadow: cs.boxShadow,
              border: cs.border,
              borderRadius: cs.borderRadius,
              attrs: Array.from(cur.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class='))
            });
            cur = cur.parentElement;
          }
        }

        // 2. 检查 banner 详情
        const banner = document.querySelector('aside[role=\"status\"], aside[class*=\"_banner_\"]');
        let bannerDetails = null;
        if (banner) {
          const cs = window.getComputedStyle(banner);
          bannerDetails = {
            tag: banner.tagName.toLowerCase(),
            className: String(banner.className),
            bg: cs.backgroundColor,
            bgImg: cs.backgroundImage,
            filter: cs.backdropFilter || cs.webkitBackdropFilter,
            boxShadow: cs.boxShadow,
            border: cs.border,
            borderRadius: cs.borderRadius,
            children: Array.from(banner.children).map(c => ({
              tag: c.tagName.toLowerCase(),
              className: String(c.className),
              bg: window.getComputedStyle(c).backgroundColor
            }))
          };
        }

        // 3. 检查页面上所有背景色不是 transparent (rgba(0, 0, 0, 0)) 并且位于下半部分 (例如 y > 400) 的元素
        const darkElementsAtBottom = [];
        for (const el of all) {
          if (el === document.body || el === document.documentElement || el.id === 'root' || el.id === 'app') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 20 && rect.top > 200) {
            const cs = window.getComputedStyle(el);
            const bg = cs.backgroundColor;
            const bgImg = cs.backgroundImage;
            // 如果背景色不是全透明
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              darkElementsAtBottom.push({
                tag: el.tagName.toLowerCase(),
                className: String(el.className).slice(0, 100),
                rect: { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) },
                bg,
                bgImg: bgImg !== 'none' ? bgImg.slice(0, 80) : 'none',
                filter: cs.backdropFilter || cs.webkitBackdropFilter,
                attrs: Array.from(el.attributes).map(a => a.name + '=' + a.value).filter(a => !a.startsWith('class=')).slice(0, 5)
              });
            }
          }
        }

        return {
          currentUrl: window.location.href,
          title: document.title,
          projectBarDetails,
          bannerDetails,
          darkElementsAtBottom
        };
      })()
    `;

    ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 2) {
      console.log(JSON.stringify(data.result?.result?.value, null, 2));
      ws.close();
    }
  };
}

main().catch(console.error);
