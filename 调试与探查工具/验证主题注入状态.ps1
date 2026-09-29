<#
.SYNOPSIS
    验证当前 ChatGPT / Codex 桌面端的 CDP 调试端口及毛玻璃主题注入状态。
.DESCRIPTION
    1. 检测本地 9335 调试端口连通性；
    2. 获取所有活跃的渲染目标页面（targets）；
    3. 调用 Node.js 探查脚本打印详细的 DOM 命中率与计算样式审计表。
.PARAMETER Port
    CDP 调试端口号，默认为 9335。
.OUTPUTS
    [bool] 验证通过返回 $true，未连接返回 $false。
.NOTES
    异常处理：捕获端口拒绝连接及网络超时异常，给出友好的排查指导。
#>
[CmdletBinding()]
param (
    [int]$Port = 9335
)

<#
.SYNOPSIS
    检测本地 CDP 端口与页面主题挂载状态
.PARAMETER TestPort
    需要检测的调试端口号
.OUTPUTS
    [bool] 成功返回 true，失败返回 false
.NOTES
    异常处理：捕获端口未监听或探查脚本执行异常
#>
function Test-CodexThemeStatus {
    [CmdletBinding()]
    param (
        [int]$TestPort
    )

    try {
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "    ChatGPT / Codex 主题注入就绪状态检测" -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Cyan

        # 1. 检查端口
        $conn = Get-NetTCPConnection -LocalPort $TestPort -ErrorAction SilentlyContinue
        if (-not $conn) {
            Write-Warning "[未就绪] 本地端口 $TestPort 未处于监听状态！"
            Write-Host "提示: 请先运行【核心脚本\启动并注入主题.ps1】启动带有调试端口的客户端。" -ForegroundColor Yellow
            return $false
        }
        Write-Host "[正常] 本地 CDP 调试端口 $TestPort 正在监听 (PID: $($conn.OwningProcess | Select-Object -First 1))" -ForegroundColor Green

        # 2. 检查 targets
        $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$TestPort/json/list" -ErrorAction SilentlyContinue
        Write-Host "[正常] 发现 $($targets.Count) 个活跃渲染目标" -ForegroundColor Green

        # 3. 运行详细探查
        $inspectScript = Join-Path $PSScriptRoot "探查界面DOM结构.mjs"
        if (Test-Path -Path $inspectScript) {
            Write-Host "正在调用 DOM 审计引擎..." -ForegroundColor Gray
            & node $inspectScript
        }

        return $true
    }
    catch {
        Write-Error "[异常] 状态检测失败：$($_.Exception.Message)"
        return $false
    }
}

Test-CodexThemeStatus -TestPort $Port
