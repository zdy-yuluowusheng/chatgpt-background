/**
 * @file 审查三个问题元素结构.mjs
 * @description 详细审查额度横幅、分支选择条以及会话底部背景层的完整选择器与样式特性。
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
        // 1. 额度横幅
        const banner = document.querySelector('aside[role=\"status\"], aside[class*=\"_banner_\"]');
        let bannerInfo = null;
        if (banner) {
          const cs = window.getComputedStyle(banner);
          bannerInfo = {
            tag: banner.tagName.toLowerCase(),
            className: banner.className,
            attributes: Array.from(banner.attributes).map(a => a.name + '="' + a.value + '"'),
            bg: cs.backgroundColor,
            bgImg: cs.backgroundImage,
            border: cs.border,
            borderRadius: cs.borderRadius,
            boxShadow: cs.boxShadow,
            filter: cs.backdropFilter || cs.webkitBackdropFilter,
            buttons: Array.from(banner.querySelectorAll('button, a')).map(b => ({
              tag: b.tagName.toLowerCase(),
              className: b.className,
              text: b.textContent?.trim(),
              bg: window.getComputedStyle(b).backgroundColor,
              color: window.getComputedStyle(b).color,
              border: window.getComputedStyle(b).border,
              borderRadius: window.getComputedStyle(b).borderRadius
            }))
          };
        }

        // 2. 输入框上方工具条（项目、分支条）
        const railItem = document.querySelector('[data-composer-rail-item], [data-composer-rail-placement], [class*=\"_item_1hrlq_\"]');
        let railInfo = null;
        if (railItem) {
          const cs = window.getComputedStyle(railItem);
          railInfo = {
            tag: railItem.tagName.toLowerCase(),
            className: railItem.className,
            attributes: Array.from(railItem.attributes).map(a => a.name + '="' + a.value + '"'),
            bg: cs.backgroundColor,
            bgImg: cs.backgroundImage,
            border: cs.border,
            borderRadius: cs.borderRadius,
            boxShadow: cs.boxShadow,
            filter: cs.backdropFilter || cs.webkitBackdropFilter,
            parent: {
              tag: railItem.parentElement?.tagName.toLowerCase(),
              className: railItem.parentElement?.className,
              attributes: Array.from(railItem.parentElement?.attributes || []).map(a => a.name + '="' + a.value + '"')
            },
            buttons: Array.from(railItem.querySelectorAll('button, div[role=\"button\"], a')).map(b => ({
              tag: b.tagName.toLowerCase(),
              className: b.className,
              text: b.textContent?.trim(),
              bg: window.getComputedStyle(b).backgroundColor,
              color: window.getComputedStyle(b).color
            }))
          };
        }

        // 3. 会话底部遮罩元素 (带有 group-has-[[data-conversation-followup... 或 pointer-events-none absolute)
        const threadBottomOverlays = Array.from(document.querySelectorAll('div[class*=\"pointer-events-none\"][class*=\"absolute\"]')).map(el => {
          const cs = window.getComputedStyle(el);
          return {
            tag: el.tagName.toLowerCase(),
            className: el.className,
            attributes: Array.from(el.attributes).map(a => a.name + '="' + a.value + '"'),
            bg: cs.backgroundColor,
            bgImg: cs.backgroundImage,
            rect: { top: el.getBoundingClientRect().top, height: el.getBoundingClientRect().height }
          };
        }).filter(item => item.bg !== 'rgba(0, 0, 0, 0)' && item.bg !== 'transparent');

        return {
          bannerInfo,
          railInfo,
          threadBottomOverlays
        };
      })()
    `;

    ws.send(JSON.stringify({ id: 3, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 3) {
      console.log(JSON.stringify(data.result?.result?.value, null, 2));
      ws.close();
    }
  };
}

main().catch(console.error);
