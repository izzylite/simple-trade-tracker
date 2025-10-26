# Fix batch 3 - Common property name issues

Write-Host "Fixing batch 3 of errors..." -ForegroundColor Cyan

# Fix ShareButton
Write-Host "`nFixing ShareButton..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.calendar_id', '.calendarId'
    $content = $content -replace '\.share_link', '.shareLink'
    $content = $content -replace '\.share_id', '.shareId'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
}

# Fix SharedCalendarPage
Write-Host "Fixing SharedCalendarPage..."
$file = "src/components/sharing/SharedCalendarPage.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.created_at', '.createdAt'
    $content = $content -replace '\briskPerTrade:', 'risk_per_trade:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedCalendarPage.tsx" -ForegroundColor Green
}

# Fix SharedTradeView
Write-Host "Fixing SharedTradeView..."
$file = "src/components/sharing/SharedTradeView.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.shared_at', '.sharedAt'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedTradeView.tsx" -ForegroundColor Green
}

# Fix TagPatternAnalysis
Write-Host "Fixing TagPatternAnalysis..."
$file = "src/components/TagPatternAnalysis.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.win_rate', '.winRate'
    $content = $content -replace '\.total_trades', '.totalTrades'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TagPatternAnalysis.tsx" -ForegroundColor Green
}

# Fix TradeCalendar
Write-Host "Fixing TradeCalendar..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix trade.date to trade.trade_date
    $content = $content -replace '\btrade\.date\b', 'trade.trade_date'
    # Fix economicCalendarFilters to economic_calendar_filters
    $content = $content -replace '\.economicCalendarFilters', '.economic_calendar_filters'
    # Fix isPinned to is_pinned
    $content = $content -replace '\.isPinned', '.is_pinned'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 3 fixes applied!" -ForegroundColor Cyan

