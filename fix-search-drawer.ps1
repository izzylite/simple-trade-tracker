# Fix SearchDrawer remaining issues

Write-Host "Fixing SearchDrawer..." -ForegroundColor Cyan

$file = "src/components/SearchDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix dateFilter.trade_type to dateFilter.type
    $content = $content -replace 'dateFilter\.trade_type', 'dateFilter.type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SearchDrawer.tsx" -ForegroundColor Green
}

Write-Host "`nSearchDrawer fixes applied!" -ForegroundColor Cyan

