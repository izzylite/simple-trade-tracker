# Fix remaining prop interfaces to use snake_case

Write-Host "Fixing remaining prop interfaces..." -ForegroundColor Cyan

# Fix ScoreSettings - metric names
Write-Host "`nFixing ScoreSettings..."
$file = "src/components/scoring/ScoreSettings.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '"winRate"', '"win_rate"'
    $content = $content -replace '"profitFactor"', '"profit_factor"'
    $content = $content -replace '"maxDrawdown"', '"max_drawdown"'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreSettings.tsx" -ForegroundColor Green
}

# Fix TagPatternAnalysis - variable names
Write-Host "Fixing TagPatternAnalysis..."
$file = "src/components/TagPatternAnalysis.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bwinRate\b', 'win_rate'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TagPatternAnalysis.tsx" -ForegroundColor Green
}

# Fix TradeCalendar - empty trade form
Write-Host "Fixing TradeCalendar..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix empty trade form properties
    $content = $content -replace '\btype:', 'trade_type:'
    $content = $content -replace '\bentry:', 'entry_price:'
    $content = $content -replace '\bexit:', 'exit_price:'
    $content = $content -replace '\bdate:', 'trade_date:'
    $content = $content -replace '\briskToReward:', 'risk_to_reward:'
    $content = $content -replace '\bpartialsTaken:', 'partials_taken:'
    $content = $content -replace '\bpendingImages:', 'pending_images:'
    $content = $content -replace '\buploadedImages:', 'uploaded_images:'
    $content = $content -replace '\beconomicEvents:', 'economic_events:'
    # Fix property access
    $content = $content -replace '\.pendingImages\b', '.pending_images'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

# Fix DayHeader - prop interface
Write-Host "Fixing DayHeader..."
$file = "src/components/trades/DayHeader.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\btotalPnL\?:', 'total_pnl?:'
    $content = $content -replace '\baccountBalance\?:', 'account_balance?:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed DayHeader.tsx" -ForegroundColor Green
}

# Fix DayDialog
Write-Host "Fixing DayDialog..."
$file = "src/components/trades/DayDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\btotalPnL:', 'total_pnl:'
    $content = $content -replace '\baccountBalance:', 'account_balance:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed DayDialog.tsx" -ForegroundColor Green
}

# Fix ImageGrid
Write-Host "Fixing ImageGrid..."
$file = "src/components/trades/ImageGrid.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.columnWidth\b', '.column_width'
    $content = $content -replace '\.uploadProgress\b', '.upload_progress'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ImageGrid.tsx" -ForegroundColor Green
}

Write-Host "`nRemaining interfaces fixed!" -ForegroundColor Cyan

