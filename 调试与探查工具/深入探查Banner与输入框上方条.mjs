/**
 * @file 深入探查Banner与输入框上方条.mjs
 * @description 详细探查 Banner 的 DOM、按钮、文本以及输入框上方 Rail 的详细样式与子元素。
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
        // 1. 查找 banner
        const banner = document.querySelector('aside[role=\"status\"], aside[class*=\"_banner_\"]');
        let bannerData = null;
        if (banner) {
          bannerData = {
            outerHTML: banner.outerHTML.slice(0, 1000),
            computed: {
              bg: window.getComputedStyle(banner).backgroundColor,
              color: window.getComputedStyle(banner).color,
              border: window.getComputedStyle(banner).border,
              borderRadius: window.getComputedStyle(banner).borderRadius,
              boxShadow: window.getComputedStyle(banner).boxShadow,
              backdropFilter: window.getComputedStyle(banner).backdropFilter
            },
            buttons: Array.from(banner.querySelectorAll('button, a')).map(b => ({
              text: b.textContent?.trim(),
              className: b.className,
              outerHTML: b.outerHTML.slice(0, 300),
              bg: window.getComputedStyle(b).backgroundColor,
              color: window.getComputedStyle(b).color,
              border: window.getComputedStyle(b).border,
              borderRadius: window.getComputedStyle(b).borderRadius
            }))
          };
        }

        // 2. 查找 rail item
        const railItem = document.querySelector('[data-composer-rail-item]');
        let railItemData = null;
        if (railItem) {
          railItemData = {
            outerHTML: railItem.outerHTML.slice(0, 800),
            computed: {
              bg: window.getComputedStyle(railItem).backgroundColor,
              color: window.getComputedStyle(railItem).color,
              border: window.getComputedStyle(railItem).border,
              borderRadius: window.getComputedStyle(railItem).borderRadius,
              boxShadow: window.getComputedStyle(railItem).boxShadow,
              backdropFilter: window.getComputedStyle(railItem).backdropFilter
            },
            buttons: Array.from(railItem.querySelectorAll('button, a')).map(b => ({
              text: b.textContent?.trim(),
              className: b.className,
              bg: window.getComputedStyle(b).backgroundColor,
              color: window.getComputedStyle(b).color,
              border: window.getComputedStyle(b).border,
              borderRadius: window.getComputedStyle(b).borderRadius
            }))
          };
        }

        // 3. 检查会话页面底部的那个黑色容器在当前页面的状态
        const threadFadeContainers = Array.from(document.querySelectorAll('[class*=\"thread-scroll-layout\"] [class*=\"bg-surface\"], [data-thread-scroll-layout] [class*=\"bg-surface\"]')).map(el => ({
          tag: el.tagName.toLowerCase(),
          className: el.className,
          bg: window.getComputedStyle(el).backgroundColor
        }));

        return {
          bannerData,
          railItemData,
          threadFadeContainers
        };
      })()
    `;

    ws.send(JSON.stringify({ id: 4, method: 'Runtime.evaluate', params: { expression: probeExpr, returnByValue: true } }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id === 4) {
      console.log('BANNER DATA:');
      console.log(JSON.stringify(data.result?.result?.value?.bannerData, null, 2));
      console.log('RAIL ITEM DATA:');
      console.log(JSON.stringify(data.result?.result?.value?.railItemData, null, 2));
      ws.close();
    }
  };
}

main().catch(console.error);
