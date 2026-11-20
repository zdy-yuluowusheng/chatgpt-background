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
 * 检查单个 WebSocket 目标的样式节点挂载情况，并在返回前安全等待句柄关闭，避免 Node 24 libuv 退出断言崩溃。
 * @param {string} wsUrl - 目标的 WebSocket 调试 URL。
 * @param {string} styleId - 目标样式标签的 ID。
 * @returns {Promise<boolean>} 挂载成功返回 true，未挂载返回 false。
 * @throws {TypeError} 当 wsUrl 或 styleId 不是有效非空字符串时抛出异常。
 */
function checkTargetStyleMounted(wsUrl, styleId) {
    if (typeof wsUrl !== 'string' || !wsUrl || typeof styleId !== 'string' || !styleId) {
        throw new TypeError('wsUrl 与 styleId 必须为非空字符串');
    }
    return new Promise((resolve) => {
        const ws = new WebSocket(wsUrl);
        let settled = false;
        let finalResult = false;
        let closeWaitTimer = null;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            clearTimeout(closeWaitTimer);
            resolve(result);
        };

        const closeAndFinish = (result) => {
            finalResult = result;
            clearTimeout(timer);
            try {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    closeWaitTimer = setTimeout(() => finish(finalResult), 200);
                    ws.close();
                    return;
                }
            } catch {}
            finish(finalResult);
        };

        const timer = setTimeout(() => closeAndFinish(false), 1500);

        ws.onopen = () => {
            const expr = `document.getElementById(${JSON.stringify(styleId)}) !== null`;
            ws.send(JSON.stringify({
                id: 9991,
                method: 'Runtime.evaluate',
                params: { expression: expr, returnByValue: true }
            }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.id === 9991) {
                    closeAndFinish(Boolean(msg.result?.result?.value));
                }
            } catch {
                closeAndFinish(false);
            }
        };

        ws.onclose = () => {
            if (!settled) {
                finish(finalResult);
            }
        };

        ws.onerror = () => closeAndFinish(false);
    });
}

/**
 * 判断调试目标是否为 ChatGPT / Codex 主应用窗口（排除桌面伙伴悬浮窗 /avatar-overlay 与登录 webview）。
 * @param {object} target - CDP `/json/list` 返回的目标对象。
 * @returns {boolean} 若为主窗口渲染目标则返回 true，否则返回 false。
 * @throws {TypeError} 当 target 不是有效对象时抛出异常。
 */
function isMainAppWindowTarget(target) {
    if (!target || typeof target !== 'object') {
        throw new TypeError('target 必须为有效对象');
    }
    if (!target.webSocketDebuggerUrl || target.type !== 'page') {
        return false;
    }
    const url = typeof target.url === 'string' ? target.url : '';
    return url.startsWith('app://-/index.html') && !url.includes('avatar-overlay');
}

/**
 * 在指定超时窗口内轮询等待主窗口样式节点挂载完成。
 * @param {number} [port=9335] - Chrome DevTools 调试端口。
 * @param {number} [timeoutMs=25000] - 等待就绪的最大超时毫秒数（兼容冷启动加载时间）。
 * @param {string} [styleId='__chatgpt_codex_custom_theme_style__'] - 注入的 style 元素 ID。
 * @returns {Promise<boolean>} 检测到主窗口已挂载样式返回 true，超时返回 false。
 * @throws {Error} 当轮询过程中发生未预期的参数错误时抛出异常。
 */
async function waitForInjectionReady(port = 9335, timeoutMs = 25000, styleId = '__chatgpt_codex_custom_theme_style__') {
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < timeoutMs) {
        attempt++;
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) });
            if (res.ok) {
                const targets = await res.json();
                if (Array.isArray(targets)) {
                    const validPages = targets.filter(t => isMainAppWindowTarget(t));
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
 * 主执行函数：轮询检查注入挂载状态并设置进程退出码，让事件循环自然退出以避免强制 exit 冲突。
 * @returns {Promise<void>} 无返回值，通过 `process.exitCode` 反映检查结果（0 成功，1 超时或异常）。
 * @throws {Error} 轮询期间发生未捕获异常时抛出异常。
 */
async function main() {
    const port = 9335;
    const isReady = await waitForInjectionReady(port, 25000);

    if (isReady) {
        console.log('[OK] 主题样式标签已成功挂载到主页面渲染内存中');
        process.exitCode = 0;
    } else {
        console.error('[TIMEOUT] 未能在超时时间内检测到主题样式挂载');
        process.exitCode = 1;
    }
    await sleep(50);
}

main().catch(err => {
    console.error('[ERROR] 检查注入异常:', err);
    process.exitCode = 1;
});
