# Fix batch 5 - More comprehensive fixes

Write-Host "Fixing batch 5 of errors..." -ForegroundColor Cyan

# Fix TradesListDialog
Write-Host "`nFixing TradesListDialog..."
$file = "src/components/charts/TradesListDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\baccount_balance:', 'accountBalance:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradesListDialog.tsx" -ForegroundColor Green
}

# Fix MonthlyStatisticsSection
Write-Host "Fixing MonthlyStatisticsSection..."
$file = "src/components/MonthlyStatisticsSection.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bmonthly_target:', 'monthlyTarget:'
    $content = $content -replace '\bmonthly_target=', 'monthlyTarget='
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed MonthlyStatisticsSection.tsx" -ForegroundColor Green
}

# Fix PerformanceCharts
Write-Host "Fixing PerformanceCharts..."
$file = "src/components/PerformanceCharts.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bmonthlyTarget:', 'monthly_target:'
    $content = $content -replace '\bmonthlyTarget=', 'monthly_target='
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PerformanceCharts.tsx" -ForegroundColor Green
}

# Fix TradeCalendar
Write-Host "Fixing TradeCalendar (round 3)..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bmonthlyTarget:', 'monthly_target:'
    $content = $content -replace '\bmonthlyTarget=', 'monthly_target='
    $content = $content -replace '\briskPerTrade:', 'risk_per_trade:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

# Fix ShareButton - return value properties
Write-Host "Fixing ShareButton (round 3)..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix the return value properties from edge function
    $content = $content -replace 'result\.share_link', 'result.shareLink'
    $content = $content -replace 'result\.share_id', 'result.shareId'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
}

# Fix TradeFormDialog
Write-Host "Fixing TradeFormDialog..."
$file = "src/components/trades/TradeFormDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.risk_to_reward', '.riskToReward'
    $content = $content -replace '\.partials_taken', '.partialsTaken'
    $content = $content -replace '\.trade_date', '.date'
    $content = $content -replace '\.trade_type', '.type'
    $content = $content -replace '\.entry_price', '.entry'
    $content = $content -replace '\.exit_price', '.exit'
    $content = $content -replace '\.economic_events', '.economicEvents'
    $content = $content -replace '\.is_temporary', '.isTemporary'
    $content = $content -replace '\.columnWidth', '.column_width'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeFormDialog.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 5 fixes applied!" -ForegroundColor Cyan

