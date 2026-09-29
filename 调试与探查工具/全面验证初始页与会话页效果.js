/**
 * @file 全面验证初始页与会话页效果.js
 * @description 将最新的 CSS 全量重新注入到客户端，分别截取“初始主页（新聊天）”和“项目会话页”的渲染截图进行双向验证。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.resolve(__dirname, '../主题样式/晨雾森林毛玻璃主题.css');

/**
 * 获取主窗口 WebSocket 地址
 * @param {number} port 端口
 * @returns {Promise<string>}
 */
async function getMainTargetWs(port = 9335) {
    const res = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = await res.json();
    const t = targets.find(item => item.type === 'page' && !item.url.includes('initialRoute'));
    if (!t) throw new Error('未找到主窗口');
    return t.webSocketDebuggerUrl;
}

/**
 * 主执行函数
 */
async function main() {
    const rawCss = fs.readFileSync(cssPath, 'utf-8');
    const wsUrl = await getMainTargetWs();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('已连接 CDP，正在同步最新 CSS 并验证...');
        
        // 1. 全量热注入 CSS 到全局主样式标签
        const injectExpr = `
            (() => {
                const styleId = '__chatgpt_codex_custom_theme_style__';
                let tag = document.getElementById(styleId);
                if (!tag) {
                    tag = document.createElement('style');
                    tag.id = styleId;
                    document.head.appendChild(tag);
                }
                tag.textContent = ${JSON.stringify(rawCss)};

                // 移除之前的临时测试补丁
                const temp = document.getElementById('__test_composer_body_style__');
                if (temp) temp.remove();

                // 切换回“新聊天”初始页面
                const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
                if (newChatBtn) {
                    newChatBtn.click();
                    return { injected: true, switchedToHome: true };
                }
                return { injected: true, switchedToHome: false };
            })()
        `;
        ws.send(JSON.stringify({ id: 501, method: 'Runtime.evaluate', params: { expression: injectExpr, returnByValue: true } }));
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.id === 501) {
            console.log('热注入并切换新聊天结果:', msg.result?.result?.value);
            // 等待 800ms 后截取初始主页全屏
            setTimeout(() => {
                ws.send(JSON.stringify({ id: 502, method: 'Page.captureScreenshot', params: { format: 'png' } }));
            }, 800);
        } else if (msg.id === 502) {
            const base64Data = msg.result?.data;
            if (base64Data) {
                const outPath = path.resolve(__dirname, '最终验证_初始主页效果.png');
                fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
                console.log(`[已保存初始主页截图]: ${outPath}`);
            }

            // 切换到会话页面并截屏
            const clickThreadExpr = `
                (() => {
                    const els = Array.from(document.querySelectorAll('*'));
                    const el = els.find(x => x.children.length === 0 && x.textContent && x.textContent.includes('整理价格分析业务表文档'));
                    if (el) {
                        const clickTarget = el.closest('button, a, div[role="button"]') || el;
                        clickTarget.click();
                        return { switched: true };
                    }
                    return { switched: false };
                })()
            `;
            setTimeout(() => {
                ws.send(JSON.stringify({ id: 503, method: 'Runtime.evaluate', params: { expression: clickThreadExpr, returnByValue: true } }));
            }, 500);
        } else if (msg.id === 503) {
            console.log('切换回项目会话结果:', msg.result?.result?.value);
            setTimeout(() => {
                ws.send(JSON.stringify({ id: 504, method: 'Page.captureScreenshot', params: { format: 'png' } }));
            }, 800);
        } else if (msg.id === 504) {
            const base64Data = msg.result?.data;
            if (base64Data) {
                const outPath = path.resolve(__dirname, '最终验证_项目会话效果.png');
                fs.writeFileSync(outPath, Buffer.from(base64Data, 'base64'));
                console.log(`[已保存项目会话截图]: ${outPath}`);
            }
            // 最后将页面切回初始主页，方便用户打开时直接查看
            const backToHomeExpr = `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                    const newChatBtn = buttons.find(b => b.textContent && b.textContent.includes('新聊天'));
                    if (newChatBtn) newChatBtn.click();
                })()
            `;
            ws.send(JSON.stringify({ id: 505, method: 'Runtime.evaluate', params: { expression: backToHomeExpr, returnByValue: true } }));
            setTimeout(() => {
                ws.close();
                console.log('所有双向验证已全部完成！');
            }, 300);
        }
    };
}

main().catch(console.error);
