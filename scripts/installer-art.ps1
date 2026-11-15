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
$accent = [System.Drawing.ColorTranslator]::FromHtml("#2F6F62")
$accentSoft = [System.Drawing.ColorTranslator]::FromHtml("#E5F1EE")

function New-BrandBitmap {
  param(
    [string]$Path,
    [int]$Width,
    [int]$Height,
    [scriptblock]$Draw
  )
  $scale = 4
  $large = New-Object System.Drawing.Bitmap(
    ($Width * $scale),
    ($Height * $scale),
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($large)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.ScaleTransform($scale, $scale)
  $graphics.Clear($bg)
  & $Draw $graphics
  $graphics.Dispose()

  $bitmap = New-Object System.Drawing.Bitmap(
    $Width,
    $Height,
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  $target = [System.Drawing.Graphics]::FromImage($bitmap)
  $target.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $target.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $target.DrawImage($large, 0, 0, $Width, $Height)
  $target.Dispose()
  $large.Dispose()
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

New-BrandBitmap (Join-Path $outDir "nsis-sidebar.bmp") 164 314 {
  param($g)
  $accentBrush = New-Brush $accent
  $accentSoftBrush = New-Brush $accentSoft
  $fgBrush = New-Brush $fg
  $wordmark = New-Font "Georgia" 27 ([System.Drawing.FontStyle]::Bold)
  $center = New-CenteredFormat
  $g.FillRectangle($accentSoftBrush, 42, 48, 80, 80)
  $g.DrawImage($icon, [System.Drawing.Rectangle]::new(50, 56, 64, 64))
  $g.DrawString("MarkSI", $wordmark, $fgBrush, [System.Drawing.RectangleF]::new(0, 150, 164, 40), $center)
  $g.FillRectangle($accentBrush, 67, 202, 30, 2)
  @($accentBrush, $accentSoftBrush, $fgBrush, $wordmark, $center) |
    ForEach-Object { $_.Dispose() }
}

New-BrandBitmap (Join-Path $outDir "wix-banner.bmp") 493 58 {
  param($g)
  $accentBrush = New-Brush $accent
  $g.FillRectangle($accentBrush, 0, 55, 493, 3)
  @($accentBrush) | ForEach-Object { $_.Dispose() }
}

New-BrandBitmap (Join-Path $outDir "wix-dialog.bmp") 493 312 {
  param($g)
  $accentBrush = New-Brush $accent
  $accentSoftBrush = New-Brush $accentSoft
  $g.FillEllipse($accentSoftBrush, 16, 108, 88, 88)
  $g.DrawImage($icon, [System.Drawing.Rectangle]::new(24, 116, 72, 72))
  $g.FillRectangle($accentBrush, 0, 309, 493, 3)
  @($accentBrush, $accentSoftBrush) | ForEach-Object { $_.Dispose() }
}

$icon.Dispose()
Write-Output "Wrote installer bitmaps to $outDir"
