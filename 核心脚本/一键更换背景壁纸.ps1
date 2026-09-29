<#
.SYNOPSIS
    一键更换 ChatGPT / Codex 背景壁纸脚本。
.DESCRIPTION
    读取用户传入的任意图片路径，自动将其压缩转码为 Base64 Data URL，
    并精准写入主题样式表中的 background-image 区块。
.PARAMETER ImagePath
    新背景图片的绝对路径或相对路径。若留空，默认使用工程自带的“壁纸原图.jpg”。
.PARAMETER Opacity
    背景遮罩层暗化度（0.0 ~ 1.0），数值越小越明亮，默认 0.50（50% 暗化）。
.OUTPUTS
    [bool] 更换成功返回 $true，异常返回 $false。
.NOTES
    异常处理：捕获文件不存在、Node.js 运行时未安装及转码失败异常并给出友好中文提示。
#>
[CmdletBinding()]
param (
    [string]$ImagePath = "",
    [double]$Opacity = 0.50
)

<#
.SYNOPSIS
    执行壁纸转码与主题样式表更新
.PARAMETER TargetImage
    目标图片路径
.PARAMETER DarkenOpacity
    暗化遮罩度
.OUTPUTS
    [bool] 成功返回 true，失败返回 false
.NOTES
    异常处理：运行时发生文件或进程异常
#>
function Invoke-WallpaperReplacement {
    [CmdletBinding()]
    param (
        [string]$TargetImage,
        [double]$DarkenOpacity
    )

    try {
        $scriptRoot = $PSScriptRoot
        $projectRoot = Split-Path -Parent $scriptRoot
        $defaultImg = Join-Path $projectRoot "主题样式\壁纸原图.jpg"
        $jsHelper = Join-Path $scriptRoot "更换背景壁纸.js"

        if (-not $TargetImage) {
            $TargetImage = $defaultImg
        }

        if (-not (Test-Path -Path $TargetImage)) {
            Write-Error "[错误] 未找到指定的图片文件: $TargetImage"
            return $false
        }

        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "    ChatGPT / Codex 晨雾森林壁纸一键更换工具" -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Cyan
        Write-Host "目标壁纸: $TargetImage" -ForegroundColor Gray
        Write-Host "暗化遮罩: $DarkenOpacity" -ForegroundColor Gray

        # 调用 Node.js 转码脚本
        & node $jsHelper $TargetImage $DarkenOpacity
        if ($LASTEXITCODE -ne 0) {
            throw "Node.js 壁纸转码与替换进程退出码异常: $LASTEXITCODE"
        }

        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "壁纸更新成功！若注入器正在运行，界面将自动热更新；" -ForegroundColor Green
        Write-Host "或在客户端窗口中按下 Ctrl + R 查看最新效果！" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Error "[异常] 更换壁纸过程失败：$($_.Exception.Message)"
        return $false
    }
}

Invoke-WallpaperReplacement -TargetImage $ImagePath -DarkenOpacity $Opacity
