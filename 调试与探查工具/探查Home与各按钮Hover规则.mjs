/**
 * @file 探查Home与各按钮Hover规则.mjs
 * @description 精确获取 Home 按钮及各侧边栏图标在默认、选中、Hover 状态下的计算背景及生效样式规则
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
        id: 9001,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === 9001) {
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
 * 主探查函数
 */
async function main() {
  const code = `
    (() => {
      const homeBtn = document.querySelector('button[data-sidebar-destination="builtin:home"]');
      const getInfo = (el, label) => {
        if (!el) return null;
        const s = window.getComputedStyle(el);
        const before = window.getComputedStyle(el, '::before');
        const after = window.getComputedStyle(el, '::after');
        return {
          label,
          tag: el.tagName,
          cls: el.className,
          bg: s.backgroundColor,
          bgImg: s.backgroundImage,
          boxShadow: s.boxShadow,
          borderRadius: s.borderRadius,
          dataset: Object.assign({}, el.dataset),
          beforeBg: before.backgroundColor,
          beforeContent: before.content,
          afterBg: after.backgroundColor,
          afterContent: after.content
        };
      };

      const results = {
        btn: getInfo(homeBtn, 'homeBtn'),
        parent: getInfo(homeBtn ? homeBtn.parentElement : null, 'parent'),
        child0: getInfo(homeBtn && homeBtn.children[0], 'child0'),
        svg: getInfo(homeBtn && homeBtn.querySelector('svg'), 'svg'),
        allRulesForBtn: []
      };

      // 遍历所有样式规则，看哪些规则选准了具有 data-selected 或 _Button_f5tnh_2 或 builtin:home
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const sel = rule.selectorText || '';
            if (sel && homeBtn.matches(sel)) {
              results.allRulesForBtn.push({
                selector: sel,
                cssText: rule.cssText
              });
            }
          }
        } catch {}
      }

      return results;
    })()
  `;

  const data = await evalInCodex(code);
  console.log('Home 按钮信息:');
  console.log('btn:', JSON.stringify(data.btn, null, 2));
  console.log('parent:', JSON.stringify(data.parent, null, 2));
  console.log('child0:', JSON.stringify(data.child0, null, 2));
  console.log('svg:', JSON.stringify(data.svg, null, 2));
  console.log('\n匹配到 Home 按钮的所有生效规则:');
  data.allRulesForBtn.forEach((r, idx) => {
    console.log(`[${idx}] ${r.selector} => ${r.cssText}`);
  });
}

main().catch(console.error);
