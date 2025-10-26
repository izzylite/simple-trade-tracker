# Fix ShareButton - use share_link and share_id from database

Write-Host "Fixing ShareButton..." -ForegroundColor Cyan

$file = "src/components/sharing/ShareButton.tsx"

if (Test-Path $file) {
    $content = Get-Content $file -Raw
    
    # Replace item.shareLink with item.share_link
    $content = $content -replace 'item\.shareLink', 'item.share_link'
    
    # Replace item.shareId with item.share_id
    $content = $content -replace 'item\.shareId', 'item.share_id'
    
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
} else {
    Write-Host "  File not found: $file" -ForegroundColor Red
}

Write-Host "`nShareButton fixed!" -ForegroundColor Cyan

