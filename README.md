# ChatGPT / Codex 桌面端毛玻璃背景与主题定制工程 (CDP In-Memory Engine)

<div align="center">

![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-blue?style=flat-square&logo=windows)
![ChatGPT / Codex](https://img.shields.io/badge/Client-ChatGPT%20%7C%20Codex-success?style=flat-square&logo=openai)
![Injection Engine](https://img.shields.io/badge/Engine-CDP%20In--Memory-brightgreen?style=flat-square)
![Architecture](https://img.shields.io/badge/Architecture-Zero--Invasive%20MSIX-orange?style=flat-square)
![Script](https://img.shields.io/badge/Script-PowerShell%20%7C%20Node.js-purple?style=flat-square&logo=powershell)
![Theme](https://img.shields.io/badge/Theme-晨雾森林%20(Morning%20Mist)-teal?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**专为 OpenAI ChatGPT 与 Codex 桌面客户端量身打造的 0 侵入毛玻璃主题注入引擎、高透晨雾森林预设、无损壁纸转码与热重载工具链**

[快速上手](#-快速上手) • [核心特性](#-核心特性) • [架构对比](#-核心架构对比cdp-vs-传统hook) • [目录结构](#-项目目录结构) • [日常工作流](#-日常定制与使用工作流) • [技术攻坚沉淀](#-攻坚历程与技术要点沉淀) • [常见问题](#-常见问题-faq) • [免责声明](#-免责声明与许可)

</div>

---

## 📖 项目简介

**ChatGPT** 与 **Codex** 桌面端是 OpenAI 针对 Windows 平台推出的原生级 AI 交互与编程辅助客户端（基于 Chromium / MSIX 容器化封装）。

然而，官方客户端默认界面存在以下痛点：
* **多层深黑背景遮罩**：侧边栏、主会话流、代码块、顶部会话标题栏均覆盖深黑或深灰色块，整体界面沉闷死板；
* **无原生背景定制能力**：客户端内未提供任何壁纸自定义、毛玻璃磨砂（Aero / Acrylic）或透明度调节设置；
* **MSIX 商店防篡改机制**：Windows 商店版受操作系统数字签名与 `TrustedInstaller` 严格保护，任何静态修改二进制文件（如解包注入、篡改入口）都会触发签名失效或文件锁报错；
* **静默升级频繁冲毁补丁**：客户端在后台自动静默推送更新时，传统文件替换补丁会被瞬间覆盖并恢复官方黑底。

**本项目提供了一套完整的现代工程化落地方案**：
* 🚀 **0 侵入式 CDP 运行时挂载**：基于 Chrome DevTools Protocol（远程调试端口 9335）建立本地 WebSocket 动态通道，在内存中完成 CSS 样式树的热挂载。**不修改任何客户端文件、不破坏商店签名、完全免疫官方自动更新**；
* 🌲 **晨雾森林极致毛玻璃主题**：通过深度 CSS 穿透与选择器契约，实现侧边栏纯透明、顶部会话栏无遮罩、代码块精致微光高透，以及输入框 **45%~50% 黄金平衡透光档位**；
* 🖼️ **全自动壁纸转码与热重载**：支持任意 4K 图片一键转码为 Base64 Data URL 内联，彻底规避 Chromium 本地协议跨域沙箱限制，保存样式文件瞬间即可在客户端无感热重载；
* 🔬 **20+ 逆向与自动化探针工具**：内建完整的 DOM 计算样式探查、哈希选择器解析、特写视口捕获与自动化截图比对工具链；
* ⚡ **极速还原能力**：无需任何反安装或文件还原操作，直接从系统开始菜单启动客户端即可 100% 恢复官方原生纯净状态。

---

## ✨ 核心特性

### 1. 深度毛玻璃高斯模糊与全维度透明化
* **侧边栏纯透明微光化**：清除 `aside.app-shell-left-panel` 内部全部 80+ 层嵌套容器的 Tailwind 叠加暗色背景，实现纯透明底色与优雅白色微光 Hover 交互。
* **顶部会话标题栏全透**：深入穿透 `header`、`_HeaderContainer_` 与 `_HeaderCenter_`，彻底移除原生 52px 高度灰色遮罩带与局部模糊，使壁纸从窗口顶端无缝贯通。
* **主会话正文纯透明呈现**：精准消除对话流背景遮挡，解决会话流“两层白框”问题，保留清晰文本对比度的同时杜绝图层遮蔽。
* **代码块与终端卡片高透磨砂**：针对 `_CodeBlock_`、`_StickyActionBar_`、`_Surface_`、`_CodeContent_`、`_BlockActions_` 等复合类名实现全层穿透，平时通透纯净并保留 `1px` 极细微光边框，悬停优雅提亮。
* **输入框 45%~50% 黄金透光档位**：
  * 清除输入框底部原生 147px 高度纯黑渐变遮罩（`bg-gradient-to-t from-surface`）；
  * 采用 `rgba(14, 22, 19, 0.24)` 暗调基底 + `backdrop-filter: blur(12px) brightness(108%) saturate(125%)` 组合算法；
  * 壁纸针对视口优化垂直锚点（`center 62%`），完美避开松林死黑阴影与泛白眩光，达到视觉通透度与文字清晰度的黄金平衡。

### 2. 0 侵入 CDP 内存级注入架构
* **免修改客户端**：客户端文件哈希值 100% 原版纯净，不触发杀毒软件误报或反篡改防护；
* **版本更新完全免疫**：客户端无论如何自动推送静默升级，只需通过受管模式拉起，主题依然稳定生效；
* **路由跳转与新会话保活**：基于 WebSocket 协议监听 DOM 生命周期事件，新建会话、切换聊天或刷新页面时样式常驻不掉；
* **受管 Profile 隔离**：遵循 Chromium 136+ 调试协议规范，配置独立受管用户数据目录，避免调试端口被内核安全策略静默忽略。

### 3. 智能壁纸转码与热重载引擎
* **Base64 纯内嵌方案**：彻底绕过 Chromium 本地协议安全沙箱限制（`https://` 严禁读取本地 `file:///` 图片），0 延迟加载；
* **智能无损压缩与缓存**：自动优化 4K 高保真壁纸体积，防止客户端渲染管线卡顿；
* **毫秒级即时热重载（Hot-Reload）**：注入守护引擎实时监控 CSS 与壁纸文件变动，保存即自动刷新注入节点，调试微调零等待。

---

## ⚖️ 核心架构对比：CDP vs 传统Hook

| 核心维度 | 传统 asar 篡改 / 动态 DLL Hook 方案 | 本工程：CDP 运行时内存挂载方案 |
| :--- | :--- | :--- |
| **底层实现机制** | 静态篡改/解包 `app.asar` 或挂接本地 DLL | **CDP (Chrome DevTools Protocol) 本地回环 WebSocket 注入** |
| **文件侵入性** | 破坏原文件，修改磁盘二进制文件 | **0 侵入、0 修改**，客户端磁盘文件 100% 原生纯净 |
| **Windows 商店签名** | 签名失效，触发系统权限拦截或无法启动 | **完全保留**，绝不触发 TrustedInstaller 拦截或反作弊机制 |
| **官方自动更新影响** | 客户端静默推送新版后补丁被覆盖失效，需重新破解 | **完全免疫**！客户端升级后只要带参启动，主题依然完美生效 |
| **样式修改生效** | 每次需重新打包 asar 或重启整个客户端 | **支持即时热重载（Hot-Reload）**，修改 CSS 文件瞬间生效 |
| **原生状态恢复** | 需寻找备份文件、重新解包或重装客户端 | **0 秒瞬间还原**：从系统开始菜单直接点原图标启动即为纯净官方版 |
| **安全性与稳定性** | 容易崩溃，有封号或被杀软隔离风险 | **基于官方提供的标准调试通道**，绿色、稳健、合规 |

---

## 📂 项目目录结构

```text
d:\work\chatgpt-background\
├── README.md                                 # [本文件] GitHub 仓库首页说明文档
├── 工程总览与使用指南.md                     # 本地工程深度架构设计与使用指南
├── .gitignore                                # Git 忽略配置（已忽略大图与运行时数据）
│
├── 主题样式\                                 # 核心样式表与壁纸资产
│   ├── 晨雾森林毛玻璃主题.css                # 深度优化的毛玻璃主题样式文件（核心 CSS）
│   ├── 壁纸原图.jpg                          # 2560x1440 晨雾松林标准高清壁纸原图
│   └── 主题配置.json                         # 主题预设参数（暗化度、模糊半径与选择器映射表）
│
├── 核心脚本\                                 # 自动化启动、注入与换壁纸脚本
│   ├── 一键启动并注入.bat                    # [最简推荐] 双击极速启动并自动挂载主题
│   ├── 启动并注入主题.ps1                    # 核心 PowerShell 入口：单实例管理与受管启动
│   ├── 运行时注入引擎.mjs                    # 基于 Node.js 原生 WebSocket 的 CDP 动态注入与热重载守护进程
│   ├── 一键更换背景壁纸.ps1                  # 支持指定图片与遮罩度的一键换壁纸便捷入口
│   └── 更换背景壁纸.js                       # 底层壁纸压缩、Base64 转换与 CSS 写回脚本
│
├── 调试与探查工具\                           # 逆向分析、DOM 结构探查与自动化截图工具集
│   ├── 探查界面DOM结构.mjs                   # 遍历当前窗口核心 DOM 节点与计算样式
│   ├── 验证主题注入状态.ps1                  # 一键检查本地 9335 调试端口与主题注入连通性
│   ├── 深入探查顶部Header组件.js             # 顶部会话标题栏背景与高斯模糊深度探查
│   ├── 深入查找输入框底层暗色渐变来源.js     # 定位输入框底部 147px 黑色渐变遮罩来源
│   ├── 深入探查Bash命令块节点与滚动.js       # 终端、代码块与已编辑文件卡片选择器测量
│   ├── 测试精准中度透光度.js                 # 输入框 45%~50% 黄金光比参数验证脚本
│   ├── 截取输入框特写截图.js                 # 自动化截取输入框局部特写验证视觉效果
│   └── ... (共 20+ 个专项调试探针)
│
└── 用户数据\                                 # 本地受管数据目录（已被 git 忽略）
    └── cdp-profile\                          # 遵循 Chromium 136+ 规范的受管独立调试目录
```

---

## 🚀 快速上手

### 环境要求
* **操作系统**：Windows 10 / 11 (64-bit)
* **运行环境**：PowerShell 5.1+ 或 PowerShell Core (pwsh)，Node.js (推荐 v18+)
* **宿主应用**：ChatGPT 桌面客户端（MSIX 商店版或官方独立安装版）

### 步骤一：克隆工程到本地
将本仓库克隆或下载到本地任意目录（例如 `d:\work\chatgpt-background`）：
```powershell
git clone https://github.com/zdy-yuluowusheng/chatgpt-background.git d:\work\chatgpt-background
cd d:\work\chatgpt-background
```

### 步骤二：一键启动并挂载主题
使用以下任意一种方式启动：

* **方式 A（双击运行，最推荐）**：
  直接在 Windows 资源管理器中双击：
  👉 **`核心脚本\一键启动并注入.bat`**

* **方式 B（PowerShell 终端启动）**：
  在工程根目录运行：
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\核心脚本\启动并注入主题.ps1
  ```

> **自动化底层流程**：
> 1. 自动检测并安全关停无调试端口的旧 ChatGPT 进程；
> 2. 携带 `--remote-debugging-port=9335` 与受管独立用户目录拉起官方客户端；
> 3. 后台激活 `运行时注入引擎.mjs`，通过 WebSocket 连接 CDP 端口；
> 4. 将高颜值晨雾森林毛玻璃主题毫秒级挂载进界面内存，呈现晶莹通透的毛玻璃效果！

### 步骤三：验证主题注入状态
在终端中执行测试脚本，快速校验当前注入连通性与命中规则数：
```powershell
powershell -ExecutionPolicy Bypass -File .\调试与探查工具\验证主题注入状态.ps1
```

### 步骤四：如何瞬间恢复官方原生状态？
* **无需任何卸载或清理**：直接点击 Windows 开始菜单或桌面原生的 **ChatGPT** 快捷方式启动。
* 因为官方客户端文件未受任何修改，直接启动将 100% 保持官方原生无主题纯净状态。

---

## 🎨 日常定制与使用工作流

### 1. 随心更换背景壁纸

#### 方式 A：指定任意图片与遮罩暗化度（最推荐）
无需重命名或拷贝文件，直接在终端指定任意图片绝对路径（支持 4K 原图自动无损优化压缩）：
```powershell
# -ImagePath: 自定义图片路径 (支持 jpg / png / webp)
# -Opacity: 背景暗化遮罩度 (默认 0.50，即 50% 遮罩，数值越小背景越通透)
powershell -ExecutionPolicy Bypass -File .\核心脚本\一键更换背景壁纸.ps1 -ImagePath "C:\Users\ylws\Pictures\我的风景壁纸.png" -Opacity 0.45
```
运行完成后，后台注入守护引擎会自动捕获变动，**客户端界面瞬间无感换上新壁纸**！

#### 方式 B：使用默认原图一键替换
将你的新壁纸重命名并覆盖到 [`主题样式/壁纸原图.jpg`](file:///d:/work/chatgpt-background/主题样式/壁纸原图.jpg)，然后直接执行：
```powershell
powershell -ExecutionPolicy Bypass -File .\核心脚本\一键更换背景壁纸.ps1
```

---

### 2. 微调主题样式（即时热重载）
直接用代码编辑器打开 [`主题样式/晨雾森林毛玻璃主题.css`](file:///d:/work/chatgpt-background/主题样式/晨雾森林毛玻璃主题.css)：
* **调节侧边栏微光度**：修改 `aside.app-shell-left-panel` 下的微光参数；
* **调节输入框透光与模糊**：修改 `composer-surface-chrome` 中的 `backdrop-filter: blur(12px) brightness(108%)`；
* **调节代码块背景微光**：修改 `div[class*="_CodeBlock_"]` 中的微光边框与透明度；
* **保存即生效**：在编辑器中按下 <kbd>Ctrl</kbd> + <kbd>S</kbd>，注入守护引擎会在数十毫秒内将最新样式热替换至客户端，无需重启！

---

### 3. 运行逆向探针与自动化验证
当官方客户端更新导致界面发生微调时，可使用内置探针快速定位最新 DOM 类名与样式属性：
```powershell
# 探查当前页面的 DOM 树结构与计算样式
node .\调试与探查工具\探查界面DOM结构.mjs

# 截取输入框当前渲染效果特写并保存为图片
node .\调试与探查工具\截取输入框特写截图.js
```

---

## 💡 攻坚历程与技术要点沉淀

在将“晨雾森林毛玻璃主题”从 Antigravity 迁移并复刻至 ChatGPT / Codex 桌面端的过程中，我们针对现代 Chromium 架构与复杂 Tailwind 混淆样式进行了深度攻坚，沉淀了如下核心经验：

| 序号 | 攻坚现象 / 核心难点 | 根本技术成因 | 最终工程化解决方案 |
| :---: | :--- | :--- | :--- |
| **01** | **主会话内容全部消失不见** | 误将含有 `data-app-shell-main-content-top-fade="visible"` 的节点整体设为隐藏，实际上该属性被挂载在**整个对话正文外层容器**上 | 精确隔离选择器范围，仅针对真正的遮罩节点 `div[class*="_MainContentTopFade_"]` 清除渐变与背景，确保主视图 100% 完整展示 |
| **02** | **左侧任务栏/侧边栏叠黑成块** | 侧边栏内部含有大量 Tailwind 实用类（`group/sidebar-rail`、`@container/navigation-header` 等），80+ 层子容器各自赋予半透明叠加后形成 100% 纯黑块 | 仅将透明/微光属性赋予顶层 `aside.app-shell-left-panel`，将内部全部嵌套子容器强制置为 `background: transparent !important` |
| **03** | **上方会话标题栏灰黑遮挡** | 顶部 Header 包含原生 52px 高度灰色背景及独立高斯模糊（`backdrop-filter: blur(16px)`），切断了壁纸向上延伸的通透感 | 锁定 `header[class*="_HeaderContainer_"]`、`div[class*="_HeaderCenter_"]` 与 `.app-shell-header`，强制清除其背景、边框阴影与模糊，实现全屏无缝贯通 |
| **04** | **代码块与终端卡片深黑死板** | 代码块及其头部包含 `_CodeBlock_`、`_StickyActionBar_`、`_Surface_`、`_CodeContent_`、`_BlockActions_` 等哈希类名与内联深黑背景 | 采用属性包含选择器 `div[class*="_CodeBlock_"]` 等进行深度复合穿透，全部置为纯透明，并搭配 `1px rgba(255, 255, 255, 0.08)` 精致微光边框 |
| **05** | **输入框底部 147px 纯黑渐变遮罩** | 原生存在全宽暗色遮罩 `div.bg-gradient-to-t.from-surface`，高度达 147px，直接抹黑了下半屏背景壁纸 | 强力穿透该渐变层，强制重置为 `background: none !important; opacity: 0 !important; pointer-events: none !important;` |
| **06** | **输入框发暗死沉 vs 泛白刺眼失衡** | 输入框直接纯透时因背景松林偏暗造成 20% 暗沉感；强行加白底则反光严重造成 70% 刺眼，文字极难阅读 | **创新研发 45%~50% 黄金光比算法**：`rgba(14, 22, 19, 0.24)` + `blur(12px) brightness(108%) saturate(125%)` + 壁纸 `center 62%` 偏置，兼备极高可读性与晶莹通透感 |
| **07** | **Chromium 136+ CDP 端口静默失效** | Chromium 136+ 引入严格安全策略，若在默认用户目录下带 `--remote-debugging-port` 启动，调试端口会被内核静默忽略 | 在启动脚本中显式配置独立的 `--user-data-dir="用户数据\cdp-profile"` 受管隔离目录，确保 9335 调试端口 100% 稳定开放 |
| **08** | **界面路由切换后主题偶发脱落** | 桌面端单页应用（SPA）在路由跳转与新建对话时会清空或重构头部 DOM | 注入引擎建立常驻 ID（`__chatgpt_codex_custom_theme_style__`）样式节点，并持续监听 `Page.navigatedWithinDocument` 与 `Page.loadEventFired` 进行自动化重注入补正 |

---

## ❓ 常见问题 (FAQ)

### Q1: 运行脚本后弹出黑色的注入终端窗口，可以关闭吗？
* **建议保持最小化**：该控制台是 `运行时注入引擎.mjs` 的守护进程，负责维持 CDP WebSocket 链接以及监听 CSS 文件的即时热重载（Hot-Reload）。
* 如果关闭了该控制台，已注入的主题在当前页面依然有效，但路由完全刷新或修改样式时的热重载功能将暂停。

### Q2: 官方发布新版本更新后，我的毛玻璃主题会失效吗？
* **完全不会**！本项目采用 CDP 运行时内存注入架构，从未改动客户端安装目录下的任何二进制文件。
* 只要客户端安装了更新，依然双击 `一键启动并注入.bat` 启动，主题将无缝在新版本中生效。

### Q3: 为什么输入框的透光度和 Antigravity 看起来一样舒适？
* 我们通过逆向探针和多轮对比验证，确立了 **45%~50% 的黄金平衡透光档位**。
* 通过在背景材质中引入微量的增亮滤镜（`brightness(108%)`）与饱和度提升（`saturate(125%)`），并对壁纸进行了 `center 62%` 的视觉纵深补偿，彻底消除了暗色壁纸在输入框底层形成的沉闷发灰现象。

### Q4: 如何恢复官方原生纯黑主题？
* 极其简单：直接从 Windows 开始菜单或桌面点击原本的 **ChatGPT** 快捷方式启动，0 秒完全恢复官方原生状态，无需任何反向操作或文件删除。

---

## 🤝 贡献与参与

非常欢迎社区开发者提交 Issue 和 Pull Request，共同完善 ChatGPT / Codex 桌面端定制生态！
* **报告未穿透的选择器**：如在某些特殊交互弹窗中发现深黑色块，欢迎提交 Issue 并附上元素审查截图；
* **贡献新壁纸预设与调光参数**：欢迎在 Discussions 中分享不同风格（二次元、赛博朋克、简约暗黑等）的壁纸搭配方案；
* **功能扩展**：欢迎优化 CDP 注入引擎的稳定性与托盘常驻守护能力。

---

## 📄 免责声明与许可

* 本项目仅用于个人学习、桌面端外观定制与逆向工程研究目的；
* ChatGPT、Codex 及相关商标的知识产权全权归 OpenAI 所有；
* 本工程所有源码遵循 [MIT 许可证](LICENSE)。
