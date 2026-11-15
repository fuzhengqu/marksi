# Generates the Windows installer brand bitmaps from the committed app icon.
# Run from the repository root: powershell -ExecutionPolicy Bypass -File scripts/installer-art.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $root "src-tauri/icons/app-icon-source.png"
$outDir = Join-Path $root "src-tauri/installer"
New-Item -ItemType Directory -Force $outDir | Out-Null
$icon = [System.Drawing.Image]::FromFile($iconPath)

$bg = [System.Drawing.ColorTranslator]::FromHtml("#F7F6F3")
$fg = [System.Drawing.ColorTranslator]::FromHtml("#26282B")
$muted = [System.Drawing.ColorTranslator]::FromHtml("#6F7378")
$faint = [System.Drawing.ColorTranslator]::FromHtml("#9B9FA4")
$accent = [System.Drawing.ColorTranslator]::FromHtml("#2F6F62")
$accentSoft = [System.Drawing.ColorTranslator]::FromHtml("#E5F1EE")

function New-BrandBitmap {
  param(
    [string]$Path,
    [int]$Width,
    [int]$Height,
    [scriptblock]$Draw
  )
  $bitmap = New-Object System.Drawing.Bitmap(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear($bg)
  & $Draw $graphics
  $graphics.Dispose()
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bitmap.Dispose()
}

function New-Brush([System.Drawing.Color]$Color) {
  return New-Object System.Drawing.SolidBrush($Color)
}

function New-Font([string]$Family, [float]$Size, [System.Drawing.FontStyle]$Style) {
  return New-Object System.Drawing.Font(
    $Family,
    $Size,
    $Style,
    [System.Drawing.GraphicsUnit]::Pixel
  )
}

function New-CenteredFormat {
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  return $format
}

New-BrandBitmap (Join-Path $outDir "nsis-header.bmp") 150 57 {
  param($g)
  $g.DrawImage($icon, [System.Drawing.Rectangle]::new(10, 10, 37, 37))
  $accentBrush = New-Brush $accent
  $fgBrush = New-Brush $fg
  $mutedBrush = New-Brush $muted
  $wordmark = New-Font "Georgia" 17 ([System.Drawing.FontStyle]::Bold)
  $tagline = New-Font "Segoe UI" 8 ([System.Drawing.FontStyle]::Regular)
  $g.DrawString("MarkSI", $wordmark, $fgBrush, 53, 11)
  $g.DrawString("Markdown studio", $tagline, $mutedBrush, 54, 33)
  $g.FillRectangle($accentBrush, 0, 54, 150, 3)
  @($accentBrush, $fgBrush, $mutedBrush, $wordmark, $tagline) |
    ForEach-Object { $_.Dispose() }
}

New-BrandBitmap (Join-Path $outDir "nsis-sidebar.bmp") 164 314 {
  param($g)
  $accentBrush = New-Brush $accent
  $accentSoftBrush = New-Brush $accentSoft
  $fgBrush = New-Brush $fg
  $mutedBrush = New-Brush $muted
  $faintBrush = New-Brush $faint
  $wordmark = New-Font "Georgia" 25 ([System.Drawing.FontStyle]::Bold)
  $tagline = New-Font "Segoe UI" 9 ([System.Drawing.FontStyle]::Regular)
  $footer = New-Font "Segoe UI" 8 ([System.Drawing.FontStyle]::Regular)
  $center = New-CenteredFormat
  $g.FillRectangle($accentSoftBrush, 42, 42, 80, 80)
  $g.DrawImage($icon, [System.Drawing.Rectangle]::new(50, 50, 64, 64))
  $g.DrawString("MarkSI", $wordmark, $fgBrush, [System.Drawing.RectangleF]::new(0, 132, 164, 34), $center)
  $g.DrawString("A focused Markdown studio", $tagline, $mutedBrush, [System.Drawing.RectangleF]::new(8, 170, 148, 34), $center)
  $g.FillRectangle($accentBrush, 67, 208, 30, 2)
  $g.DrawString("Local-first  |  MIT licensed", $footer, $faintBrush, [System.Drawing.RectangleF]::new(8, 270, 148, 20), $center)
  @($accentBrush, $accentSoftBrush, $fgBrush, $mutedBrush, $faintBrush, $wordmark, $tagline, $footer, $center) |
    ForEach-Object { $_.Dispose() }
}

New-BrandBitmap (Join-Path $outDir "wix-banner.bmp") 493 58 {
  param($g)
  $accentBrush = New-Brush $accent
  $fgBrush = New-Brush $fg
  $mutedBrush = New-Brush $muted
  $wordmark = New-Font "Georgia" 20 ([System.Drawing.FontStyle]::Bold)
  $tagline = New-Font "Segoe UI" 9 ([System.Drawing.FontStyle]::Regular)
  $g.DrawImage($icon, [System.Drawing.Rectangle]::new(18, 12, 34, 34))
  $g.DrawString("MarkSI", $wordmark, $fgBrush, 61, 7)
  $g.DrawString("A focused Markdown studio", $tagline, $mutedBrush, 63, 33)
  $g.FillRectangle($accentBrush, 0, 55, 493, 3)
  @($accentBrush, $fgBrush, $mutedBrush, $wordmark, $tagline) |
    ForEach-Object { $_.Dispose() }
}

New-BrandBitmap (Join-Path $outDir "wix-dialog.bmp") 493 312 {
  param($g)
  $accentBrush = New-Brush $accent
  $accentSoftBrush = New-Brush $accentSoft
  $fgBrush = New-Brush $fg
  $mutedBrush = New-Brush $muted
  $faintBrush = New-Brush $faint
  $wordmark = New-Font "Georgia" 31 ([System.Drawing.FontStyle]::Bold)
  $tagline = New-Font "Segoe UI" 11 ([System.Drawing.FontStyle]::Regular)
  $footer = New-Font "Segoe UI" 9 ([System.Drawing.FontStyle]::Regular)
  $center = New-CenteredFormat
  $g.FillEllipse($accentSoftBrush, 186, 42, 120, 120)
  $g.DrawImage($icon, [System.Drawing.Rectangle]::new(202, 58, 88, 88))
  $g.DrawString("MarkSI", $wordmark, $fgBrush, [System.Drawing.RectangleF]::new(0, 172, 493, 44), $center)
  $g.DrawString("A focused Markdown studio", $tagline, $mutedBrush, [System.Drawing.RectangleF]::new(40, 220, 413, 28), $center)
  $g.FillRectangle($accentBrush, 226, 254, 40, 2)
  $g.DrawString("Local-first  |  MIT licensed", $footer, $faintBrush, [System.Drawing.RectangleF]::new(40, 272, 413, 20), $center)
  @($accentBrush, $accentSoftBrush, $fgBrush, $mutedBrush, $faintBrush, $wordmark, $tagline, $footer, $center) |
    ForEach-Object { $_.Dispose() }
}

$icon.Dispose()
Write-Output "Wrote installer bitmaps to $outDir"
