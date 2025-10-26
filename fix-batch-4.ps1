# Fix batch 4 - More property name issues

Write-Host "Fixing batch 4 of errors..." -ForegroundColor Cyan

# Fix ShareButton - shareLink and shareId
Write-Host "`nFixing ShareButton (round 2)..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.shareLink', '.share_link'
    $content = $content -replace '\.shareId', '.share_id'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
}

# Fix SharedCalendarPage - accountBalance
Write-Host "Fixing SharedCalendarPage (round 2)..."
$file = "src/components/sharing/SharedCalendarPage.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\baccountBalance:', 'account_balance:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedCalendarPage.tsx" -ForegroundColor Green
}

# Fix TradeDetailExpanded
Write-Host "Fixing TradeDetailExpanded..."
$file = "src/components/TradeDetailExpanded.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economic_calendar_filters', '.economicCalendarFilters'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeDetailExpanded.tsx" -ForegroundColor Green
}

# Fix TradeCalendar - riskPerTrade
Write-Host "Fixing TradeCalendar (round 2)..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\briskPerTrade=', 'risk_per_trade='
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 4 fixes applied!" -ForegroundColor Cyan

