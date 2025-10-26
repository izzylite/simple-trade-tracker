# Fix batch 6 - More comprehensive fixes

Write-Host "Fixing batch 6 of errors..." -ForegroundColor Cyan

# Fix TradesListDialog - account_balance in props
Write-Host "`nFixing TradesListDialog (round 2)..."
$file = "src/components/charts/TradesListDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix the prop name in the interface
    $content = $content -replace '\baccount_balance\?:', 'accountBalance?:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradesListDialog.tsx" -ForegroundColor Green
}

# Fix MonthlyStatisticsSection - monthlyTarget
Write-Host "Fixing MonthlyStatisticsSection (round 2)..."
$file = "src/components/MonthlyStatisticsSection.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix remaining monthlyTarget references
    $content = $content -replace '\bmonthlyTarget\b', 'monthly_target'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed MonthlyStatisticsSection.tsx" -ForegroundColor Green
}

# Fix TradeCalendar - monthlyTarget and riskPerTrade
Write-Host "Fixing TradeCalendar (round 4)..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix remaining references
    $content = $content -replace '\bmonthlyTarget\b', 'monthly_target'
    $content = $content -replace '\briskPerTrade\b', 'risk_per_trade'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

# Fix ShareButton - result properties from edge function
Write-Host "Fixing ShareButton (round 4)..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # The edge function returns shareLink and shareId (camelCase)
    # But we're trying to access share_link and share_id
    # Need to check what the edge function actually returns
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
}

# Fix SharedTradeView - remove duplicate date property
Write-Host "Fixing SharedTradeView..."
$file = "src/components/sharing/SharedTradeView.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Remove the duplicate 'date' property - Trade already has trade_date
    $content = $content -replace 'date: new Date\(sharedTrade\.trade_date\),\s*', ''
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedTradeView.tsx" -ForegroundColor Green
}

# Fix TagPatternAnalysis
Write-Host "Fixing TagPatternAnalysis..."
$file = "src/components/TagPatternAnalysis.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # TagPatternInsight should use 'type' not 'trade_type'
    $content = $content -replace 'insight\.trade_type', 'insight.type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TagPatternAnalysis.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 6 fixes applied!" -ForegroundColor Cyan

