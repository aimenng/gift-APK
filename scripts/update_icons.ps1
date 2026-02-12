
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

# Function to find content bounds (trim white/light background)
function Get-ContentBounds($bmp) {
    $width = $bmp.Width
    $height = $bmp.Height
    $minX = $width
    $minY = $height
    $maxX = 0
    $maxY = 0
    
    # Simple threshold for "not white"
    $threshold = 240 
    
    for ($y = 0; $y -lt $height; $y++) {
        for ($x = 0; $x -lt $width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
            # Check if pixel is NOT white/light
            if ($pixel.R -lt $threshold -or $pixel.G -lt $threshold -or $pixel.B -lt $threshold) {
                if ($x -lt $minX) { $minX = $x }
                if ($x -gt $maxX) { $maxX = $x }
                if ($y -lt $minY) { $minY = $y }
                if ($y -gt $maxY) { $maxY = $y }
            }
        }
    }
    
    if ($maxX -lt $minX) { return $null } # Found nothing
    
    $w = $maxX - $minX + 1
    $h = $maxY - $minY + 1
    
    # Make it square
    if ($w -gt $h) {
        $diff = $w - $h
        $minY -= [math]::Floor($diff / 2)
        $h = $w
    }
    elseif ($h -gt $w) {
        $diff = $h - $w
        $minX -= [math]::Floor($diff / 2)
        $w = $h
    }
    
    # Clamp bounds
    if ($minX -lt 0) { $minX = 0 }
    if ($minY -lt 0) { $minY = 0 }
    if ($minX + $w -gt $width) { $w = $width - $minX }
    if ($minY + $h -gt $height) { $h = $height - $minY }
    
    return New-Object System.Drawing.Rectangle $minX, $minY, $w, $h
}

Write-Host "Detecting content bounds..."
$trimRect = Get-ContentBounds $srcInfo
if ($trimRect -eq $null) {
    Write-Warning "Could not detect bounds, using full image."
    $trimRect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
}
else {
    Write-Host "Found bounds: $($trimRect.X), $($trimRect.Y), $($trimRect.Width), $($trimRect.Height)"
}

# Crop to detected bounds
$cropSize = $trimRect.Width
$cropped = New-Object System.Drawing.Bitmap $cropSize, $cropSize
$g = [System.Drawing.Graphics]::FromImage($cropped)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Create a brush/attributes to make white transparent? 
# JPG compression makes this hard. Better to just crop tight.
# Or apply a "Squircle" mask to the result to force clean corners?
# User said "rounded, not circle". Let's apply a Squircle mask and crop tight.

$g.DrawImage($srcInfo, (New-Object System.Drawing.Rectangle 0, 0, $cropSize, $cropSize), $trimRect, [System.Drawing.GraphicsUnit]::Pixel)

# Apply Squircle Mask (Rounded Corners) to cleaning up edges
$squircle = New-Object System.Drawing.Drawing2D.GraphicsPath
$corner = [int]($cropSize * 0.22) # Large rounded corners for Squircle look
$d = $corner * 2
$squircle.AddArc(0, 0, $d, $d, 180, 90)
$squircle.AddArc($cropSize - $d, 0, $d, $d, 270, 90)
$squircle.AddArc($cropSize - $d, $cropSize - $d, $d, $d, 0, 90)
$squircle.AddArc(0, $cropSize - $d, $d, $d, 90, 90)
$squircle.CloseFigure()

$final = New-Object System.Drawing.Bitmap $cropSize, $cropSize
$gf = [System.Drawing.Graphics]::FromImage($final)
$gf.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gf.SetClip($squircle)
$gf.DrawImage($cropped, 0, 0, $cropSize, $cropSize)
$gf.Dispose()
$g.Dispose()

# Use $final for resizing
$cropped.Dispose()
$cropped = $final

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
    
    # Round icon with circular mask
    $round = New-Object System.Drawing.Bitmap $size, $size
    $gr = [System.Drawing.Graphics]::FromImage($round)
    $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Create circular path
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $size, $size)
    $gr.SetClip($path)
    
    $gr.DrawImage($cropped, 0, 0, $size, $size)
    
    $roundPath = Join-Path $targetPath "ic_launcher_round.png"
    $round.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $gr.Dispose()
    $round.Dispose()
    
    $g2.Dispose()
    $resized.Dispose()
    
    Write-Host "Saved $folder ($size x $size)"
}

# Generate 216x216 Store Icon
$storeSize = 216
$storePath = "c:\Users\xhb23\Desktop\good\gifts---APK\gifts---couple-connection\docs\store_icon_216.png"
$resizedStore = New-Object System.Drawing.Bitmap $storeSize, $storeSize
$gStore = [System.Drawing.Graphics]::FromImage($resizedStore)
$gStore.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gStore.DrawImage($cropped, 0, 0, $storeSize, $storeSize)
$resizedStore.Save($storePath, [System.Drawing.Imaging.ImageFormat]::Png)
$gStore.Dispose()
$resizedStore.Dispose()
Write-Host "Saved Store Icon (216x216) to docs\store_icon_216.png"

$cropped.Dispose()
$srcInfo.Dispose()
