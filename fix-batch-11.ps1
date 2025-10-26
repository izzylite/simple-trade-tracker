# Fix batch 11 - EconomicEvent and other type fixes

Write-Host "Fixing batch 11..." -ForegroundColor Cyan

# Fix EconomicCalendarDrawer - EconomicEvent uses 'date' not 'trade_date'
Write-Host "`nFixing EconomicCalendarDrawer..."
$file = "src/components/economicCalendar/EconomicCalendarDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # EconomicEvent has 'date' property, not 'trade_date'
    # The groupedEvents structure also uses 'date' not 'trade_date'
    # These are correct - no changes needed for EconomicEvent.date
    Write-Host "  Skipping EconomicCalendarDrawer.tsx (EconomicEvent uses 'date' not 'trade_date')" -ForegroundColor Yellow
}

# Fix useHighImpactEvents - EconomicEvent uses 'date' not 'trade_date'
Write-Host "`nFixing useHighImpactEvents..."
$file = "src/hooks/useHighImpactEvents.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # EconomicEvent has 'date' property, not 'trade_date'
    Write-Host "  Skipping useHighImpactEvents.ts (EconomicEvent uses 'date' not 'trade_date')" -ForegroundColor Yellow
}

# Fix PerformanceCharts - Trade doesn't have deleted_at property
Write-Host "`nFixing PerformanceCharts..."
$file = "src/components/PerformanceCharts.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Remove references to deleted_at (Trade doesn't have this property)
    $content = $content -replace '&& !trade\.deleted_at', ''
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PerformanceCharts.tsx" -ForegroundColor Green
}

# Fix CalendarCard - Handle undefined values
Write-Host "`nFixing CalendarCard..."
$file = "src/components/CalendarCard.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Add || 0 to handle undefined values
    $content = $content -replace 'formatPercentage\(stats\.win_rate\)', 'formatPercentage(stats.win_rate || 0)'
    $content = $content -replace 'formatNumber\(stats\.profit_factor\)', 'formatNumber(stats.profit_factor || 0)'
    $content = $content -replace 'formatPercentage\(stats\.max_drawdown\)', 'formatPercentage(stats.max_drawdown || 0)'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed CalendarCard.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 11 fixed!" -ForegroundColor Cyan

