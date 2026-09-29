/**
 * @file 检查注入是否就绪.js
 * @description 检测本地 CDP 调试端口的主窗口是否已成功挂载毛玻璃主题样式标签，
 *              用于启动脚本在自动退出前确认注入状态。
 */

/**
 * 延迟指定毫秒数
 * @param {number} ms 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查单个 WebSocket 目标的样式节点挂载情况
 * @param {string} wsUrl 目标的 WebSocket 调试 URL
 * @param {string} styleId 目标样式标签的 ID
 * @returns {Promise<boolean>} 挂载成功返回 true，未挂载返回 false
 * @throws {Error} 网络通信或协议交互异常
 */
function checkTargetStyleMounted(wsUrl, styleId) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => {
            try { ws.close(); } catch {}
            resolve(false);
        }, 1500);

        ws.onopen = () => {
            const expr = `document.getElementById(${JSON.stringify(styleId)}) !== null`;
            ws.send(JSON.stringify({
                id: 9991,
                method: 'Runtime.evaluate',
                params: { expression: expr, returnByValue: true }
            }));
        };

        ws.onmessage = (event) => {
            clearTimeout(timer);
            try {
                const msg = JSON.parse(event.data);
                if (msg.id === 9991) {
                    const exists = !!msg.result?.result?.value;
                    ws.close();
                    resolve(exists);
                }
            } catch {
                ws.close();
                resolve(false);
            }
        };

        ws.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
    });
}

/**
 * 轮询等待 CDP 端口就绪并验证样式挂载状态
 * @param {number} port CDP 调试端口号
 * @param {number} timeoutMs 最大等待超时时间（毫秒）
 * @param {string} styleId 样式标签 ID
 * @returns {Promise<boolean>} 在超时时间内注入成功返回 true，否则返回 false
 * @throws {Error} 致命异常时抛出错误
 */
async function waitForInjectionReady(port = 9335, timeoutMs = 12000, styleId = '__chatgpt_codex_custom_theme_style__') {
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < timeoutMs) {
        attempt++;
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) });
            if (res.ok) {
                const targets = await res.json();
                if (Array.isArray(targets)) {
                    const validPages = targets.filter(t => t.webSocketDebuggerUrl && (t.type === 'page' || t.type === 'webview'));
                    for (const page of validPages) {
                        const isMounted = await checkTargetStyleMounted(page.webSocketDebuggerUrl, styleId);
                        if (isMounted) {
                            return true;
                        }
                    }
                }
            }
        } catch {
            // 端口可能尚未监听，等待重试
        }
        await sleep(500);
    }

    return false;
}

/**
 * 主执行函数
 * @returns {Promise<void>}
 */
async function main() {
    const port = 9335;
    const isReady = await waitForInjectionReady(port, 12000);

    if (isReady) {
        console.log('[OK] 主题样式标签已成功挂载到主页面渲染内存中');
        process.exit(0);
    } else {
        console.error('[TIMEOUT] 未能在超时时间内检测到主题样式挂载');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('[ERROR] 检查注入异常:', err);
    process.exit(1);
});
