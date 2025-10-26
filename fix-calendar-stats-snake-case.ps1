# Fix all CalendarStats references to use snake_case

Write-Host "Converting CalendarStats to snake_case..." -ForegroundColor Cyan

# Get all TypeScript files that might use CalendarStats
$files = Get-ChildItem -Path "src" -Recurse -Include "*.tsx","*.ts" -Exclude "*.test.ts","*.test.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Fix CalendarStats property access
    $content = $content -replace '\.winRate\b', '.win_rate'
    $content = $content -replace '\.profitFactor\b', '.profit_factor'
    $content = $content -replace '\.maxDrawdown\b', '.max_drawdown'
    $content = $content -replace '\.targetProgress\b', '.target_progress'
    $content = $content -replace '\.pnlPerformance\b', '.pnl_performance'
    $content = $content -replace '\.totalTrades\b', '.total_trades'
    $content = $content -replace '\.winCount\b', '.win_count'
    $content = $content -replace '\.lossCount\b', '.loss_count'
    $content = $content -replace '\.totalPnL\b', '.total_pnl'
    $content = $content -replace '\.drawdownStartDate\b', '.drawdown_start_date'
    $content = $content -replace '\.drawdownEndDate\b', '.drawdown_end_date'
    $content = $content -replace '\.drawdownRecoveryNeeded\b', '.drawdown_recovery_needed'
    $content = $content -replace '\.drawdownDuration\b', '.drawdown_duration'
    $content = $content -replace '\.avgWin\b', '.avg_win'
    $content = $content -replace '\.avgLoss\b', '.avg_loss'
    $content = $content -replace '\.currentBalance\b', '.current_balance'
    $content = $content -replace '\.initialBalance\b', '.initial_balance'
    $content = $content -replace '\.growthPercentage\b', '.growth_percentage'
    $content = $content -replace '\.weeklyPnL\b', '.weekly_pnl'
    $content = $content -replace '\.monthlyPnL\b', '.monthly_pnl'
    $content = $content -replace '\.yearlyPnL\b', '.yearly_pnl'
    $content = $content -replace '\.weeklyPnLPercentage\b', '.weekly_pnl_percentage'
    $content = $content -replace '\.monthlyPnLPercentage\b', '.monthly_pnl_percentage'
    $content = $content -replace '\.yearlyPnLPercentage\b', '.yearly_pnl_percentage'
    $content = $content -replace '\.weeklyProgress\b', '.weekly_progress'
    $content = $content -replace '\.monthlyProgress\b', '.monthly_progress'
    $content = $content -replace '\.yearlyProgress\b', '.yearly_progress'
    
    # Fix object property names
    $content = $content -replace '\bwinRate:', 'win_rate:'
    $content = $content -replace '\bprofitFactor:', 'profit_factor:'
    $content = $content -replace '\bmaxDrawdown:', 'max_drawdown:'
    $content = $content -replace '\btargetProgress:', 'target_progress:'
    $content = $content -replace '\bpnlPerformance:', 'pnl_performance:'
    $content = $content -replace '\btotalTrades:', 'total_trades:'
    $content = $content -replace '\bwinCount:', 'win_count:'
    $content = $content -replace '\blossCount:', 'loss_count:'
    $content = $content -replace '\btotalPnL:', 'total_pnl:'
    $content = $content -replace '\bdrawdownStartDate:', 'drawdown_start_date:'
    $content = $content -replace '\bdrawdownEndDate:', 'drawdown_end_date:'
    $content = $content -replace '\bdrawdownRecoveryNeeded:', 'drawdown_recovery_needed:'
    $content = $content -replace '\bdrawdownDuration:', 'drawdown_duration:'
    $content = $content -replace '\bavgWin:', 'avg_win:'
    $content = $content -replace '\bavgLoss:', 'avg_loss:'
    $content = $content -replace '\bcurrentBalance:', 'current_balance:'
    $content = $content -replace '\binitialBalance:', 'initial_balance:'
    $content = $content -replace '\bgrowthPercentage:', 'growth_percentage:'
    $content = $content -replace '\bweeklyPnL:', 'weekly_pnl:'
    $content = $content -replace '\bmonthlyPnL:', 'monthly_pnl:'
    $content = $content -replace '\byearlyPnL:', 'yearly_pnl:'
    $content = $content -replace '\bweeklyPnLPercentage:', 'weekly_pnl_percentage:'
    $content = $content -replace '\bmonthlyPnLPercentage:', 'monthly_pnl_percentage:'
    $content = $content -replace '\byearlyPnLPercentage:', 'yearly_pnl_percentage:'
    $content = $content -replace '\bweeklyProgress:', 'weekly_progress:'
    $content = $content -replace '\bmonthlyProgress:', 'monthly_progress:'
    $content = $content -replace '\byearlyProgress:', 'yearly_progress:'
    
    # Only write if content changed
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "  Fixed $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nCalendarStats conversion complete!" -ForegroundColor Cyan

