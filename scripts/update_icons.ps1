
Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\xhb23\.gemini\antigravity\brain\f7ff4eaf-0d98-4b61-8d98-ec954afd4fe5\media__1770918854607.jpg"
$resDir = "c:\Users\xhb23\Desktop\good\gifts---APK\gifts---couple-connection\android\app\src\main\res"

if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file not found: $sourcePath"
    exit 1
}

$sizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

$srcInfo = [System.Drawing.Image]::FromFile($sourcePath)
$width = $srcInfo.Width
$height = $srcInfo.Height

Write-Host "Source Image: $width x $height"

# Calculate crop
$cropMargin = [int][math]::Round($width * 0.07)
$cropSize = [int]($width - ($cropMargin * 2))

Write-Host "Crop Margin: $cropMargin, Crop Size: $cropSize"

if ($cropSize -le 0) {
    Write-Error "Invalid crop size"
    exit 1
}

$cropRect = New-Object System.Drawing.Rectangle $cropMargin, $cropMargin, $cropSize, $cropSize
$destRect = New-Object System.Drawing.Rectangle 0, 0, $cropSize, $cropSize

$cropped = New-Object System.Drawing.Bitmap $cropSize, $cropSize
$g = [System.Drawing.Graphics]::FromImage($cropped)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($srcInfo, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

Write-Host "Cropped successfully"

foreach ($folder in $sizes.Keys) {
    $size = [int]$sizes[$folder]
    $targetPath = Join-Path $resDir $folder
    if (!(Test-Path $targetPath)) { New-Item -ItemType Directory -Force -Path $targetPath | Out-Null }

    # Resize for ic_launcher.png
    $resized = New-Object System.Drawing.Bitmap $size, $size
    $g2 = [System.Drawing.Graphics]::FromImage($resized)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.DrawImage($cropped, 0, 0, $size, $size)
    
    $iconPath = Join-Path $targetPath "ic_launcher.png"
    
    # Save as PNG
    $resized.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Round icon (same for now)
    $roundPath = Join-Path $targetPath "ic_launcher_round.png"
    $resized.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $g2.Dispose()
    $resized.Dispose()
    
    Write-Host "Saved $folder ($size x $size)"
}

$cropped.Dispose()
$srcInfo.Dispose()
