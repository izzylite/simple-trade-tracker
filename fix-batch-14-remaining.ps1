# Fix batch 14 - Remaining production code fixes

Write-Host "Fixing batch 14 - Remaining production code..." -ForegroundColor Cyan

# Fix performanceCalculationService - economicEvents to economic_events in return objects
Write-Host "`nFixing performanceCalculationService..."
$file = "src/services/performanceCalculationService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\beconomicEvents:', 'economic_events:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed performanceCalculationService.ts" -ForegroundColor Green
}

# Fix sharingService - Trade.date to Trade.trade_date (remaining instances)
Write-Host "`nFixing sharingService..."
$file = "src/services/sharingService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix any remaining .date references that should be .trade_date
    $content = $content -replace '(\$\{trade\.)date', '$1trade_date'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed sharingService.ts" -ForegroundColor Green
}

# Fix tagPatternService - remaining camelCase properties
Write-Host "`nFixing tagPatternService..."
$file = "src/services/tagPatternService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\btotalPnL:', 'total_pnl:'
    $content = $content -replace '\bavgPnL:', 'avg_pnl:'
    $content = $content -replace '\brecentWinRate:', 'recent_win_rate:'
    $content = $content -replace '\bhistoricalWinRate:', 'historical_win_rate:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed tagPatternService.ts" -ForegroundColor Green
}

# Fix chartDataUtils - remaining camelCase properties
Write-Host "`nFixing chartDataUtils..."
$file = "src/utils/chartDataUtils.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\btotalTrades:', 'total_trades:'
    $content = $content -replace '\bwinRate:', 'win_rate:'
    $content = $content -replace '\btotalPnL:', 'total_pnl:'
    $content = $content -replace '\baveragePnL:', 'average_pnl:'
    $content = $content -replace '\bpnlPercentage:', 'pnl_percentage:'
    $content = $content -replace '\bwinTrades:', 'win_trades:'
    $content = $content -replace '\blossTrades:', 'loss_trades:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed chartDataUtils.ts" -ForegroundColor Green
}

# Fix scoreUtils - remaining camelCase properties
Write-Host "`nFixing scoreUtils..."
$file = "src/utils/scoreUtils.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bavgRiskReward:', 'avg_risk_reward:'
    $content = $content -replace '\bpreferredSessions:', 'preferred_sessions:'
    $content = $content -replace '\bcommonTags:', 'common_tags:'
    $content = $content -replace '\bavgTradesPerDay:', 'avg_trades_per_day:'
    $content = $content -replace '\bavgTradesPerWeek:', 'avg_trades_per_week:'
    $content = $content -replace '\bavgPositionSize:', 'avg_position_size:'
    $content = $content -replace '\bwinRate:', 'win_rate:'
    $content = $content -replace '\bprofitFactor:', 'profit_factor:'
    $content = $content -replace '\bmaxDrawdown:', 'max_drawdown:'
    $content = $content -replace '\btradingDays:', 'trading_days:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed scoreUtils.ts" -ForegroundColor Green
}

# Fix statsUtils - remaining camelCase properties
Write-Host "`nFixing statsUtils..."
$file = "src/utils/statsUtils.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bmaxDrawdown:', 'max_drawdown:'
    $content = $content -replace '\bdrawdownRecoveryNeeded:', 'drawdown_recovery_needed:'
    $content = $content -replace '\bdrawdownDuration:', 'drawdown_duration:'
    $content = $content -replace '\bavgWin:', 'avg_win:'
    $content = $content -replace '\bavgLoss:', 'avg_loss:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed statsUtils.ts" -ForegroundColor Green
}

# Fix EconomicCalendarDrawer - groupedEvents uses 'date' not 'trade_date'
Write-Host "`nFixing EconomicCalendarDrawer..."
$file = "src/components/economicCalendar/EconomicCalendarDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # The groupedEvents structure uses 'date' property, not 'trade_date'
    $content = $content -replace '\.trade_date', '.date'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed EconomicCalendarDrawer.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 14 remaining fixes complete!" -ForegroundColor Cyan

