# Fix major remaining issues

Write-Host "Fixing major issues..." -ForegroundColor Cyan

# Fix SearchDrawer - economicEvents to economic_events
Write-Host "`nFixing SearchDrawer..."
$file = "src/components/SearchDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicEvents', '.economic_events'
    $content = $content -replace '\btrade\.type\b', 'trade.trade_type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SearchDrawer.tsx" -ForegroundColor Green
}

# Fix PinnedTradesDrawer - trade.type to trade.trade_type
Write-Host "Fixing PinnedTradesDrawer..."
$file = "src/components/PinnedTradesDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\btrade\.type\b', 'trade.trade_type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PinnedTradesDrawer.tsx" -ForegroundColor Green
}

# Fix PerformanceCharts - deleted_at check
Write-Host "Fixing PerformanceCharts..."
$file = "src/components/PerformanceCharts.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Revert the incorrect deleted_at check
    $content = $content -replace 'trade\.deleted_at === null \|\| trade\.deleted_at === undefined', '!trade.deleted_at'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PerformanceCharts.tsx" -ForegroundColor Green
}

# Fix LinkComponent - remaining trade_type references
Write-Host "Fixing LinkComponent remaining issues..."
$file = "src/components/common/RichTextEditor/components/LinkComponent.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix any remaining trade_type that should be type
    $content = $content -replace 'linkInfo\.trade_type', 'linkInfo.type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed LinkComponent.tsx" -ForegroundColor Green
}

# Fix ScoreBreakdown - win_rate and profit_factor
Write-Host "Fixing ScoreBreakdown..."
$file = "src/components/scoring/ScoreBreakdown.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.win_rate', '.winRate'
    $content = $content -replace '\.profit_factor', '.profitFactor'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreBreakdown.tsx" -ForegroundColor Green
}

# Fix ScoreSettings - win_rate, profit_factor, max_drawdown
Write-Host "Fixing ScoreSettings..."
$file = "src/components/scoring/ScoreSettings.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.win_rate', '.winRate'
    $content = $content -replace '\.profit_factor', '.profitFactor'
    $content = $content -replace '\.max_drawdown', '.maxDrawdown'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreSettings.tsx" -ForegroundColor Green
}

Write-Host "`nAll major fixes applied!" -ForegroundColor Cyan

