# PowerShell script to convert remaining camelCase to snake_case

Write-Host "Converting remaining camelCase to snake_case..."

# Get all TypeScript/TSX files
$files = Get-ChildItem -Path "src" -Recurse -Include "*.ts","*.tsx" | Where-Object { $_.FullName -notmatch "node_modules" }

$count = 0
foreach ($file in $files) {
    $count++
    Write-Host "Processing $count of $($files.Count): $($file.Name)"
    
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Calendar properties
    if ($content -match '\.lastModified') { $content = $content -replace '\.lastModified', '.updated_at'; $modified = $true }
    if ($content -match '\.heroImageUrl') { $content = $content -replace '\.heroImageUrl', '.hero_image_url'; $modified = $true }
    if ($content -match '\.heroImageAttribution') { $content = $content -replace '\.heroImageAttribution', '.hero_image_attribution'; $modified = $true }
    if ($content -match '\.daysNotes') { $content = $content -replace '\.daysNotes', '.days_notes'; $modified = $true }
    if ($content -match '\.pinnedEvents') { $content = $content -replace '\.pinnedEvents', '.pinned_events'; $modified = $true }
    if ($content -match '\.totalPnL') { $content = $content -replace '\.totalPnL', '.total_pnl'; $modified = $true }
    
    # Trade properties
    if ($content -match '\.entry\b') { $content = $content -replace '\.entry\b', '.entry_price'; $modified = $true }
    if ($content -match '\.exit\b') { $content = $content -replace '\.exit\b', '.exit_price'; $modified = $true }
    
    # CalendarStats properties (keep camelCase for UI)
    if ($content -match 'stats\.win_rate') { $content = $content -replace 'stats\.win_rate', 'stats.winRate'; $modified = $true }
    if ($content -match 'stats\.win_count') { $content = $content -replace 'stats\.win_count', 'stats.winCount'; $modified = $true }
    if ($content -match 'stats\.loss_count') { $content = $content -replace 'stats\.loss_count', 'stats.lossCount'; $modified = $true }
    if ($content -match 'stats\.profit_factor') { $content = $content -replace 'stats\.profit_factor', 'stats.profitFactor'; $modified = $true }
    if ($content -match 'stats\.avg_win') { $content = $content -replace 'stats\.avg_win', 'stats.avgWin'; $modified = $true }
    if ($content -match 'stats\.avg_loss') { $content = $content -replace 'stats\.avg_loss', 'stats.avgLoss'; $modified = $true }
    if ($content -match 'stats\.max_drawdown') { $content = $content -replace 'stats\.max_drawdown', 'stats.maxDrawdown'; $modified = $true }
    if ($content -match 'stats\.drawdown_recovery_needed') { $content = $content -replace 'stats\.drawdown_recovery_needed', 'stats.drawdownRecoveryNeeded'; $modified = $true }
    if ($content -match 'stats\.drawdown_duration') { $content = $content -replace 'stats\.drawdown_duration', 'stats.drawdownDuration'; $modified = $true }
    if ($content -match 'stats\.drawdown_start_date') { $content = $content -replace 'stats\.drawdown_start_date', 'stats.drawdownStartDate'; $modified = $true }
    if ($content -match 'stats\.drawdown_end_date') { $content = $content -replace 'stats\.drawdown_end_date', 'stats.drawdownEndDate'; $modified = $true }
    if ($content -match 'stats\.weekly_progress') { $content = $content -replace 'stats\.weekly_progress', 'stats.weeklyProgress'; $modified = $true }
    if ($content -match 'stats\.monthly_progress') { $content = $content -replace 'stats\.monthly_progress', 'stats.monthlyProgress'; $modified = $true }
    if ($content -match 'stats\.total_trades') { $content = $content -replace 'stats\.total_trades', 'stats.totalTrades'; $modified = $true }
    
    # DynamicRiskSettings properties (convert to snake_case)
    if ($content -match '\bdynamicRiskEnabled\b') { $content = $content -replace '\bdynamicRiskEnabled\b', 'dynamic_risk_enabled'; $modified = $true }
    if ($content -match '\bincreasedRiskPercentage\b') { $content = $content -replace '\bincreasedRiskPercentage\b', 'increased_risk_percentage'; $modified = $true }
    if ($content -match '\bprofitThresholdPercentage\b') { $content = $content -replace '\bprofitThresholdPercentage\b', 'profit_threshold_percentage'; $modified = $true }
    
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "  Modified: $($file.Name)" -ForegroundColor Green
    }
}

Write-Host "`nConversion complete! Processed $count files." -ForegroundColor Cyan

