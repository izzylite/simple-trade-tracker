# Fix batch 13 - Final production code fixes

Write-Host "Fixing batch 13 - Final production code..." -ForegroundColor Cyan

# Fix EconomicCalendarDrawer - groupedEvents uses 'date' not 'trade_date'
Write-Host "`nFixing EconomicCalendarDrawer..."
$file = "src/components/economicCalendar/EconomicCalendarDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # The groupedEvents structure uses 'date' property
    # No changes needed - already fixed
    Write-Host "  Skipping EconomicCalendarDrawer.tsx (already fixed)" -ForegroundColor Yellow
}

# Fix performanceCalculationService - economicEvents to economic_events
Write-Host "`nFixing performanceCalculationService..."
$file = "src/services/performanceCalculationService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicEvents', '.economic_events'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed performanceCalculationService.ts" -ForegroundColor Green
}

# Fix sharingService - Trade.date to Trade.trade_date
Write-Host "`nFixing sharingService..."
$file = "src/services/sharingService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'trade\.date', 'trade.trade_date'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed sharingService.ts" -ForegroundColor Green
}

# Fix tradeEconomicEventService - EconomicEvent.trade_date to EconomicEvent.date
Write-Host "`nFixing tradeEconomicEventService..."
$file = "src/services/tradeEconomicEventService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace 'event\.trade_date', 'event.date'
    # Fix TradeEconomicEvent property names
    $content = $content -replace 'flagCode:', 'flag_code:'
    $content = $content -replace 'timeUtc:', 'time_utc:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed tradeEconomicEventService.ts" -ForegroundColor Green
}

# Fix statsUtils - drawdownStartDate to drawdown_start_date
Write-Host "`nFixing statsUtils..."
$file = "src/utils/statsUtils.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bdrawdownStartDate\b', 'drawdown_start_date'
    $content = $content -replace '\bdrawdownEndDate\b', 'drawdown_end_date'
    $content = $content -replace '\bmaxDrawdown:', 'max_drawdown:'
    $content = $content -replace '\bdrawdownRecoveryNeeded:', 'drawdown_recovery_needed:'
    $content = $content -replace '\bdrawdownDuration:', 'drawdown_duration:'
    $content = $content -replace '\bavgWin:', 'avg_win:'
    $content = $content -replace '\bavgLoss:', 'avg_loss:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed statsUtils.ts" -ForegroundColor Green
}

# Fix chartDataUtils - totalTrades to total_trades, winRate to win_rate
Write-Host "`nFixing chartDataUtils..."
$file = "src/utils/chartDataUtils.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.total_trades', '.totalTrades'
    $content = $content -replace '\.win_rate', '.winRate'
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

# Fix tradeExportImport - initialBalance to initial_balance, accountBalance to account_balance
Write-Host "`nFixing tradeExportImport..."
$file = "src/utils/tradeExportImport.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\binitialBalance\b', 'initial_balance'
    $content = $content -replace '\.account_balance', '.accountBalance'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed tradeExportImport.ts" -ForegroundColor Green
}

# Fix tagPatternService - winRate to win_rate, totalPnL to total_pnl, avgPnL to avg_pnl
Write-Host "`nFixing tagPatternService..."
$file = "src/services/tagPatternService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bwinRate:', 'win_rate:'
    $content = $content -replace '\btotalPnL:', 'total_pnl:'
    $content = $content -replace '\bavgPnL:', 'avg_pnl:'
    $content = $content -replace '\brecentWinRate:', 'recent_win_rate:'
    $content = $content -replace '\bhistoricalWinRate:', 'historical_win_rate:'
    $content = $content -replace '\bavgTradesPerDay:', 'avg_trades_per_day:'
    $content = $content -replace '\bavgTradesPerWeek:', 'avg_trades_per_week:'
    $content = $content -replace '\bavgPositionSize:', 'avg_position_size:'
    $content = $content -replace '\bavgRiskReward:', 'avg_risk_reward:'
    $content = $content -replace '\bpreferredSessions:', 'preferred_sessions:'
    $content = $content -replace '\bcommonTags:', 'common_tags:'
    $content = $content -replace '\bprofitFactor:', 'profit_factor:'
    $content = $content -replace '\bmaxDrawdown:', 'max_drawdown:'
    $content = $content -replace '\btradingDays:', 'trading_days:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed tagPatternService.ts" -ForegroundColor Green
}

# Fix scoreUtils - similar pattern
Write-Host "`nFixing scoreUtils..."
$file = "src/utils/scoreUtils.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bpreferredSessions:', 'preferred_sessions:'
    $content = $content -replace '\bcommonTags:', 'common_tags:'
    $content = $content -replace '\bavgTradesPerDay:', 'avg_trades_per_day:'
    $content = $content -replace '\bavgTradesPerWeek:', 'avg_trades_per_week:'
    $content = $content -replace '\bavgPositionSize:', 'avg_position_size:'
    $content = $content -replace '\bavgRiskReward:', 'avg_risk_reward:'
    $content = $content -replace '\bwinRate:', 'win_rate:'
    $content = $content -replace '\bprofitFactor:', 'profit_factor:'
    $content = $content -replace '\bmaxDrawdown:', 'max_drawdown:'
    $content = $content -replace '\btradingDays:', 'trading_days:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed scoreUtils.ts" -ForegroundColor Green
}

Write-Host "`nBatch 13 final fixes complete!" -ForegroundColor Cyan

