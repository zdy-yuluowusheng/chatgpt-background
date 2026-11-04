/**
 * @file 截取所有活跃目标画面.mjs
 * @description 遍历 CDP 中所有的渲染目标（包含 page、webview、iframe），逐个捕获其屏幕画面并保存，精准查出哪一个 target 正在渲染模糊的 Word 预览。
 * @author Antigravity Assistant
 */

import fs from 'fs';
const PORT = 9335;
const HOST = '127.0.0.1';

/**
 * 截取单个 target 画面
 * 
 * @param {object} target - target 对象
 * @param {string} outPath - 输出路径
 * @returns {Promise<boolean>} 成功返回 true
 */
function captureTarget(target, outPath) {
  return new Promise((resolve) => {
    if (!target.webSocketDebuggerUrl) return resolve(false);
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 5000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.captureScreenshot', params: { format: 'png' } }));
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.id === 1 && data.result?.data) {
          clearTimeout(timeout);
          fs.writeFileSync(outPath, Buffer.from(data.result.data, 'base64'));
          ws.close();
          resolve(true);
        }
      } catch {
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      ws.close();
      resolve(false);
    };
  });
}

/**
 * 主执行函数
 * 
 * @returns {Promise<void>} 无返回值
 */
async function main() {
  const res = await fetch(`http://${HOST}:${PORT}/json/list`);
  const list = await res.json();
  console.log(`发现 ${list.length} 个 targets:`);

  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const filename = `d:/work/chatgpt-background/调试与探查工具/目标_${i}_${t.type}_${t.id.substring(0, 6)}.png`;
    const ok = await captureTarget(t, filename);
    console.log(`[${i}] ${t.type} "${t.title}" (${t.id}) 截图: ${ok ? filename : '失败/不支持'}`);
  }
}

main();
