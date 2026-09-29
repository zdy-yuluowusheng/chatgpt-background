/**
 * @file 运行时注入引擎.mjs
 * @description 基于 Chrome DevTools Protocol (CDP) 的轻量级运行时主题注入守护引擎。
 *              通过 loopback WebSocket 在渲染进程内存中动态挂载毛玻璃 CSS 样式表，
 *              实现零破坏性、抗更新、支持 CSS 即时热重载（Hot-Reload）的定制体验。
 * @author Antigravity Assistant
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 默认配置
const CONFIG = {
  port: 9335,
  host: '127.0.0.1',
  pollIntervalMs: 2000,
  styleId: '__chatgpt_codex_custom_theme_style__',
  cssPath: path.resolve(__dirname, '../主题样式/晨雾森林毛玻璃主题.css'),
};

/**
 * 异步请求 CDP HTTP 接口，获取当前可用的 targets 或 version 信息
 * 
 * @param {string} endpoint - 目标端点路径（如 '/json/list' 或 '/json/version'）
 * @returns {Promise<Array<object>|object|null>} 响应解析后的 JSON 对象，网络不可达时返回 null
 * @throws {Error} 当网络连接严重异常或 JSON 格式非法时处理错误
 */
async function queryCdpEndpoint(endpoint) {
  try {
    const url = `http://${CONFIG.host}:${CONFIG.port}${endpoint}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * 读取当前本地的主题 CSS 文件内容
 * 
 * @param {string} filePath - 本地 CSS 文件路径
 * @returns {string} 完整的 CSS 文本内容
 * @throws {Error} 文件不存在或读取异常时抛出错误
 */
function readCurrentCss(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`主题样式表不存在: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[读取CSS异常] ${err.message}`);
    return '';
  }
}

/**
 * 构造注入到页面的 JavaScript 执行代码
 * 
 * @param {string} cssContent - 待挂载的 CSS 样式代码
 * @param {string} styleId - DOM 树中 style 标签的唯一标识 ID
 * @returns {string} 序列化后的可执行 JavaScript 代码片段
 * @throws {void} 无异常抛出
 */
function buildInjectionScript(cssContent, styleId) {
  const serializedCss = JSON.stringify(cssContent);
  const serializedId = JSON.stringify(styleId);

  return `
    (() => {
      try {
        const id = ${serializedId};
        const css = ${serializedCss};
        let style = document.getElementById(id);
        if (!style) {
          style = document.createElement('style');
          style.id = id;
          style.setAttribute('data-injected-by', 'chatgpt-background-cdp');
          (document.head || document.documentElement).appendChild(style);
        }
        if (style.textContent !== css) {
          style.textContent = css;
        }
        return { success: true, updated: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    })();
  `;
}

/**
 * 单个 CDP 渲染窗口连接器类，维护单页面生命周期内的 WebSocket 与样式挂载
 */
class PageInjectorSession {
  /**
   * 初始化页面注入会话
   * 
   * @param {object} target - CDP target 描述对象（包含 id, title, webSocketDebuggerUrl 等）
   * @param {string} cssPath - CSS 文件路径
   */
  constructor(target, cssPath) {
    this.target = target;
    this.cssPath = cssPath;
    this.ws = null;
    this.msgId = 1;
    this.callbacks = new Map();
    this.isConnected = false;
  }

  /**
   * 启动 WebSocket 连接并初始化 Page/Runtime 域
   * 
   * @returns {Promise<boolean>} 连接并就绪返回 true，失败返回 false
   * @throws {Error} 捕获底层网络异常
   */
  connect() {
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.target.webSocketDebuggerUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          console.log(`[连接成功] 已连上页面: "${this.target.title || 'ChatGPT/Codex'}"`);
          
          // 开启 Page 和 Runtime 事件监听
          this.sendCommand('Runtime.enable');
          this.sendCommand('Page.enable');

          // 立即注入样式
          this.injectStyle();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // 处理命令响应
            if (data.id && this.callbacks.has(data.id)) {
              const cb = this.callbacks.get(data.id);
              this.callbacks.delete(data.id);
              cb(data.result);
            }
            // 路由导航或页面重载时重新注样式
            if (data.method === 'Page.loadEventFired' || 
                data.method === 'Page.navigatedWithinDocument' ||
                data.method === 'Page.frameNavigated') {
              this.injectStyle();
            }
          } catch {
            // 忽略解析错误
          }
        };

        this.ws.onerror = () => {
          this.isConnected = false;
          resolve(false);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          console.log(`[连接断开] 页面会话已关闭: ${this.target.id}`);
        };
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * 向当前渲染窗口发送 CDP 请求协议帧
   * 
   * @param {string} method - CDP 方法名（如 'Runtime.evaluate'）
   * @param {object} [params={}] - 方法调用参数
   * @returns {Promise<object>} 返回方法执行结果
   * @throws {Error} 异常时返回 null
   */
  sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return resolve(null);
      }
      const id = this.msgId++;
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /**
   * 执行样式注入
   * 
   * @returns {Promise<void>}
   * @throws {void}
   */
  async injectStyle() {
    const css = readCurrentCss(this.cssPath);
    if (!css) return;

    const script = buildInjectionScript(css, CONFIG.styleId);
    await this.sendCommand('Runtime.evaluate', {
      expression: script,
      returnByValue: true,
      userGesture: true,
      awaitPromise: true,
    });
    console.log(`[样式已挂载] 成功更新页面样式: "${this.target.title || '主窗口'}" (${new Date().toLocaleTimeString()})`);
  }

  /**
   * 关闭当前 WebSocket 会话
   * 
   * @returns {void}
   */
  dispose() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}

/**
 * 守护引擎核心类，负责监听 CDP 端口变动、多窗口多标签页管理与 CSS 文件热重载
 */
class CdpThemeInjectorDaemon {
  /**
   * 初始化守护引擎
   */
  constructor() {
    this.activeSessions = new Map(); // targetId -> PageInjectorSession
    this.isPolling = false;
  }

  /**
   * 启动守护引擎主循环
   * 
   * @returns {Promise<void>}
   * @throws {Error} 捕获全局未捕获异常
   */
  async start() {
    console.log('==========================================================');
    console.log('    ChatGPT / Codex 运行时毛玻璃主题注入守护引擎');
    console.log('==========================================================');
    console.log(`监听端点: http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`主题文件: ${CONFIG.cssPath}`);
    console.log('正在等待客户端启动并开启调试接口...\n');

    // 1. 启动 CSS 文件变更监听（热重载）
    this.setupCssFileWatcher();

    // 2. 循环轮询 targets
    setInterval(() => {
      this.pollTargets();
    }, CONFIG.pollIntervalMs);

    // 首次立即轮询一次
    await this.pollTargets();
  }

  /**
   * 设置本地 CSS 样式表文件的文件监听器，变更时全量推送热更新
   * 
   * @returns {void}
   * @throws {void} 内部捕获 watcher 异常
   */
  setupCssFileWatcher() {
    try {
      let debounceTimer = null;
      fs.watch(CONFIG.cssPath, (eventType) => {
        if (eventType === 'change') {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            console.log('\n[热重载触发] 检测到主题 CSS 文件被修改，正在向所有窗口推送最新样式...');
            for (const session of this.activeSessions.values()) {
              if (session.isConnected) {
                session.injectStyle();
              }
            }
          }, 300);
        }
      });
      console.log('[热重载就绪] 已启用 CSS 实时动态热重载');
    } catch (err) {
      console.warn(`[热重载警告] 无法监听 CSS 文件: ${err.message}`);
    }
  }

  /**
   * 轮询目标端口，检索当前活跃的界面 target 并接入
   * 
   * @returns {Promise<void>}
   * @throws {void}
   */
  async pollTargets() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const targets = await queryCdpEndpoint('/json/list');
      if (!targets || !Array.isArray(targets)) {
        // 端口未开启或应用未启动
        if (this.activeSessions.size > 0) {
          console.log('[状态变更] 客户端连接已中断，正在等待重连...');
          for (const session of this.activeSessions.values()) {
            session.dispose();
          }
          this.activeSessions.clear();
        }
        return;
      }

      // 筛选有效的主页面渲染目标（type 为 page，且具有调试 WebSocket URL）
      const validPages = targets.filter((t) => {
        return t.webSocketDebuggerUrl && (t.type === 'page' || t.type === 'webview');
      });

      const currentTargetIds = new Set(validPages.map((t) => t.id));

      // 清理已关闭的 targets
      for (const [id, session] of this.activeSessions.entries()) {
        if (!currentTargetIds.has(id)) {
          session.dispose();
          this.activeSessions.delete(id);
        }
      }

      // 为新发现的 targets 建立注入会话
      for (const target of validPages) {
        if (!this.activeSessions.has(target.id)) {
          const session = new PageInjectorSession(target, CONFIG.cssPath);
          this.activeSessions.set(target.id, session);
          await session.connect();
        }
      }
    } catch (err) {
      console.error(`[轮询异常] ${err.message}`);
    } finally {
      this.isPolling = false;
    }
  }
}

// 主入口执行
const daemon = new CdpThemeInjectorDaemon();
daemon.start();
