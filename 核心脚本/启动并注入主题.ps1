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

        # 2. 检查并处理单实例与旧守护进程冲突
        Write-Host "[2/6] 正在检查进程状态并清理旧实例..." -ForegroundColor Gray
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

        # 清理可能残留的旧注入守护进程，避免多进程冲突
        Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*运行时注入引擎.mjs*" } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }

        # 3. 准备专用的受管 CDP 用户数据目录（Chromium 136+ 强约束）
        $projectRoot = Split-Path -Parent $PSScriptRoot
        $profileDir = Join-Path $projectRoot "用户数据\cdp-profile"
        if (-not (Test-Path -Path $profileDir)) {
            New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
        }
        Write-Host "[3/6] 已就绪受管 CDP Profile 目录: $profileDir" -ForegroundColor Green

        # 4. 以注册的 AUMID 应用入口安全启动客户端（彻底消除“该进程没有程序包标识符”报错）
        Write-Host "[4/6] 正在通过应用注册入口启动客户端 (监听端口: $ListenPort)..." -ForegroundColor Gray
        $aumid = "$($pkg.PackageFamilyName)!App"
        $arguments = "--remote-debugging-port=$ListenPort"
        
        Start-Process -FilePath "shell:AppsFolder\$aumid" -ArgumentList $arguments
        Start-Sleep -Seconds 2
        Write-Host "客户端已安全拉起，已获得官方程序包完整标识符。" -ForegroundColor Green

        # 5. 启动 Node.js 运行时注入引擎 (以隐藏窗口模式静默在后台运行)
        Write-Host "[5/6] 正在拉起主题注入守护引擎 (后台静默运行，无黑窗口)..." -ForegroundColor Gray
        $injectorScript = Join-Path $PSScriptRoot "运行时注入引擎.mjs"

        $injectorProcess = Start-Process -FilePath "node" `
            -ArgumentList "`"$injectorScript`"" `
            -WorkingDirectory $projectRoot `
            -WindowStyle Hidden `
            -PassThru

        # 6. 验证样式是否成功注入生效，确认无误后自动退出窗口
        Write-Host "[6/6] 正在校验毛玻璃主题挂载状态，确认渲染生效..." -ForegroundColor Gray
        $checkerScript = Join-Path $PSScriptRoot "检查注入是否就绪.js"

        $verifySuccess = $false
        $verifyOutput = & node "$checkerScript" 2>&1
        if ($LASTEXITCODE -eq 0) {
            $verifySuccess = $true
        }

        if ($verifySuccess) {
            Write-Host ""
            Write-Host "==========================================================" -ForegroundColor Green
            Write-Host "    [✔ 注入成功] 晨雾森林毛玻璃主题已在客户端完美生效！" -ForegroundColor Green
            Write-Host "==========================================================" -ForegroundColor Green
            Write-Host "* 注入引擎正在后台静默守护，支持即时热重载与会话切换保活。" -ForegroundColor Gray
            Write-Host "* 状态校验确认无误，本窗口将在 2 秒后自动关闭..." -ForegroundColor Cyan
            Write-Host "==========================================================" -ForegroundColor Green
            Start-Sleep -Seconds 2
            return $true
        } else {
            Write-Warning "[超时提示] 未能在规定时间内确认主题挂载状态，但客户端已成功拉起。"
            Write-Host "若界面未显示毛玻璃效果，可尝试在客户端中按 Ctrl+R 刷新。" -ForegroundColor Yellow
            Write-Host ""
            Read-Host "按回车键关闭本窗口"
            return $false
        }
    }
    catch {
        Write-Error "[异常] 启动注入流程失败：$($_.Exception.Message)"
        Write-Host ""
        Read-Host "按回车键关闭本窗口"
        return $false
    }
}

$success = Start-CodexWithThemeInjection -ListenPort $Port -AutoRestart $RestartExisting
if ($success) {
    exit 0
} else {
    exit 1
}
