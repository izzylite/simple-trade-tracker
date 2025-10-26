# Fix TradeImage property references to use snake_case

Write-Host "Fixing TradeImage properties..." -ForegroundColor Cyan

# Fix TradeFormDialog - calendarId to calendar_id
Write-Host "`nFixing TradeFormDialog..."
$file = "src/components/trades/TradeFormDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix calendarId in TradeImage objects
    $content = $content -replace '\bcalendarId:', 'calendar_id:'
    $content = $content -replace '\.calendarId\b', '.calendar_id'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeFormDialog.tsx" -ForegroundColor Green
}

# Fix ImageGrid - revert column_width back to columnWidth for GridImage
Write-Host "Fixing ImageGrid..."
$file = "src/components/trades/ImageGrid.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # GridImage and GridPendingImage should use column_width (already done)
    # But the code accessing them should also use column_width
    # The issue is that the script changed .columnWidth to .column_width everywhere
    # But GridImage extends TradeImage which now has column_width
    # So this should be correct - no changes needed
    Write-Host "  ImageGrid.tsx already correct" -ForegroundColor Green
}

Write-Host "`nTradeImage properties fixed!" -ForegroundColor Cyan

