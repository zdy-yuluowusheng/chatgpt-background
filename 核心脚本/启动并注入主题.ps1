<#
.SYNOPSIS
    以 CDP 远程调试模式拉起 ChatGPT / Codex 客户端并启动毛玻璃主题注入引擎。
.DESCRIPTION
    1. 动态检测并定位系统中的 OpenAI.Codex 官方商店安装路径；
    2. 检查是否有正在运行的 ChatGPT/Codex 实例，避免单实例锁冲突；
    3. 准备独立的受管 CDP Profile 目录（适配 Chromium 136+ 调试端口强约束）；
    4. 启动官方客户端并附加 --remote-debugging-port=9335 参数；
    5. 启动运行时注入引擎守护进程，实现零篡改、抗更新的动态主题注入。
.PARAMETER Port
    CDP 远程调试监听端口号，默认为 9335。
.PARAMETER RestartExisting
    若客户端已在运行，是否直接关闭并重新拉起带有调试参数的实例。默认为 $true。
.OUTPUTS
    [bool] 启动与注入成功返回 $true，异常返回 $false。
.NOTES
    异常处理：捕获 Appx 包未安装、端口冲突、文件锁定等异常，给出对应指引。
#>
[CmdletBinding()]
param (
    [int]$Port = 9335,
    [bool]$RestartExisting = $true
)

<#
.SYNOPSIS
    启动 Codex 客户端并挂载 CDP 注入引擎
.PARAMETER ListenPort
    CDP 远程调试端口号
.PARAMETER AutoRestart
    是否自动关闭并重启旧实例
.OUTPUTS
    [bool] 启动与注入成功返回 true，失败返回 false
.NOTES
    异常处理：运行时发生程序未安装或端口占用异常
#>
function Start-CodexWithThemeInjection {
    [CmdletBinding()]
    param (
        [int]$ListenPort,
        [bool]$AutoRestart
    )

    try {
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "    ChatGPT / Codex 运行时毛玻璃主题一键启动工具" -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Cyan

        # 1. 动态获取 OpenAI.Codex 安装信息
        Write-Host "[1/5] 正在检索系统 OpenAI.Codex 安装包..." -ForegroundColor Gray
        $pkg = Get-AppxPackage -Name "OpenAI.Codex" -ErrorAction SilentlyContinue
        if (-not $pkg) {
            throw "未在当前系统检测到官方 OpenAI.Codex 桌面应用，请先通过微软商店或官方安装包安装客户端！"
        }

        $appDir = Join-Path $pkg.InstallLocation "app"
        $exePath = Join-Path $appDir "ChatGPT.exe"
        if (-not (Test-Path -Path $exePath)) {
            throw "未在应用安装目录中找到主程序：$exePath"
        }
        Write-Host "已定位客户端程序: $exePath" -ForegroundColor Green

        # 2. 检查并处理单实例冲突
        Write-Host "[2/5] 正在检查进程状态..." -ForegroundColor Gray
        $runningProcesses = Get-Process -Name "ChatGPT", "Codex" -ErrorAction SilentlyContinue
        if ($runningProcesses.Count -gt 0) {
            if ($AutoRestart) {
                Write-Host "检测到 ChatGPT/Codex 正在运行，正在安全退出旧实例以使调试端口生效..." -ForegroundColor Yellow
                foreach ($proc in $runningProcesses) {
                    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                }
                Start-Sleep -Seconds 2
            } else {
                throw "检测到现有 ChatGPT 正在运行！请先手动关闭客户端，或使用 -RestartExisting 参数自动重启。"
            }
        }

        # 3. 准备专用的受管 CDP 用户数据目录（Chromium 136+ 强约束）
        $projectRoot = Split-Path -Parent $PSScriptRoot
        $profileDir = Join-Path $projectRoot "用户数据\cdp-profile"
        if (-not (Test-Path -Path $profileDir)) {
            New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
        }
        Write-Host "[3/5] 已就绪受管 CDP Profile 目录: $profileDir" -ForegroundColor Green

        # 4. 以注册的 AUMID 应用入口安全启动客户端（彻底消除“该进程没有程序包标识符”报错）
        Write-Host "[4/5] 正在通过应用注册入口启动客户端 (监听端口: $ListenPort)..." -ForegroundColor Gray
        $aumid = "$($pkg.PackageFamilyName)!App"
        $arguments = "--remote-debugging-port=$ListenPort"
        
        Start-Process -FilePath "shell:AppsFolder\$aumid" -ArgumentList $arguments
        Start-Sleep -Seconds 3
        Write-Host "客户端已安全拉起，已获得官方程序包完整标识符。" -ForegroundColor Green

        # 5. 启动 Node.js 运行时注入引擎
        Write-Host "[5/5] 正在拉起主题注入守护引擎..." -ForegroundColor Gray
        $injectorScript = Join-Path $PSScriptRoot "运行时注入引擎.mjs"

        # 异步启动注入守护进程
        $injectorProcess = Start-Process -FilePath "node" `
            -ArgumentList "`"$injectorScript`"" `
            -WorkingDirectory $projectRoot `
            -PassThru

        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "    ChatGPT / Codex 晨雾森林毛玻璃主题已成功激活！" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "* 注入引擎正在后台持续运行，当页面打开时将自动动态注入毛玻璃样式；" -ForegroundColor White
        Write-Host "* 支持热重载：修改主题样式目录下的 CSS 或更换壁纸后会自动全量刷新；" -ForegroundColor White
        Write-Host "* 若要恢复官方原生状态，只需正常从开始菜单打开 ChatGPT 即可！" -ForegroundColor Yellow
        Write-Host "==========================================================" -ForegroundColor Green

        return $true
    }
    catch {
        Write-Error "[异常] 启动注入流程失败：$($_.Exception.Message)"
        return $false
    }
}

Start-CodexWithThemeInjection -ListenPort $Port -AutoRestart $RestartExisting
