# Fix final batch of common errors

Write-Host "Fixing final batch of errors..."

# Fix TradesListDialog - accountBalance
Write-Host "Fixing TradesListDialog..."
$file = "src/components/charts/TradesListDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\baccountBalance\b', 'account_balance'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradesListDialog.tsx" -ForegroundColor Green
}

# Fix WinLossDistribution - total_trades
Write-Host "Fixing WinLossDistribution..."
$file = "src/components/charts/WinLossDistribution.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.total_trades', '.totalTrades'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed WinLossDistribution.tsx" -ForegroundColor Green
}

# Fix PinnedTradesDrawer - economicEvents
Write-Host "Fixing PinnedTradesDrawer..."
$file = "src/components/PinnedTradesDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicEvents', '.economic_events'
    $content = $content -replace '\.type\b', '.trade_type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PinnedTradesDrawer.tsx" -ForegroundColor Green
}

# Fix PerformanceCharts - isDeleted
Write-Host "Fixing PerformanceCharts..."
$file = "src/components/PerformanceCharts.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.isDeleted', '.deleted_at'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PerformanceCharts.tsx" -ForegroundColor Green
}

# Fix EconomicCalendarDrawer - trade_date
Write-Host "Fixing EconomicCalendarDrawer..."
$file = "src/components/economicCalendar/EconomicCalendarDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # This is a complex fix - trade_date should be 'date' for EconomicEvent
    # We'll need to check the context
    Write-Host "  Skipping EconomicCalendarDrawer.tsx - needs manual review" -ForegroundColor Yellow
}

# Fix CalendarCard - Calendar type
Write-Host "Fixing CalendarCard..."
$file = "src/components/CalendarCard.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'calendar: Calendar\b', 'calendar: CalendarWithUIState'
    $content = $content -replace 'import \{ Calendar \}', 'import { Calendar, CalendarWithUIState }'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed CalendarCard.tsx" -ForegroundColor Green
}

Write-Host "`nAll fixes applied!" -ForegroundColor Cyan

