/**
 * @file 探查设置路由与触发器.mjs
 * @description 寻找页面内部打开设置（settings）的函数、React 属性或事件触发方式
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
        id: 9971,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9971) {
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
 * 主逻辑
 */
async function main() {
  const code = `
    (() => {
      const results = {};
      // 检查当前 hash 或 history
      results.location = {
        href: window.location.href,
        hash: window.location.hash,
        pathname: window.location.pathname
      };

      // 展开个人菜单
      const avatarBtn = document.querySelector('button[aria-label="打开个人资料菜单"]');
      if (avatarBtn) {
        const rect = avatarBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, clientX: rect.x + 10, clientY: rect.y + 10, pointerId: 1, button: 0 };
        avatarBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        avatarBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        avatarBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        avatarBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        avatarBtn.dispatchEvent(new MouseEvent('click', opts));
      }

      return results;
    })()
  `;

  const info = await evalInCodex(code);
  console.log('Location info:', info);

  await new Promise(r => setTimeout(r, 500));

  // 此时探查弹出的菜单中，每一个项的 React Props 或者 onSelect 处理函数
  const inspectMenuItemsCode = `
    (() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
      return items.map(it => {
        const reactKey = Object.keys(it).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
        const props = reactKey ? it[reactKey] : null;
        return {
          text: (it.textContent || '').trim(),
          tag: it.tagName,
          cls: it.className,
          id: it.id,
          hasProps: !!props,
          propKeys: props ? Object.keys(props).slice(0, 10) : []
        };
      });
    })()
  `;

  const menuItems = await evalInCodex(inspectMenuItemsCode);
  console.log('菜单项详情:', JSON.stringify(menuItems, null, 2));
}

main().catch(console.error);
