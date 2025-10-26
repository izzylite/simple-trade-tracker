# Fix batch 9 - Remaining component issues

Write-Host "Fixing batch 9..." -ForegroundColor Cyan

# Fix ScoreSettings - still has old string literals (these weren't fixed properly before)
Write-Host "`nFixing ScoreSettings (final fix)..."
$file = "src/components/scoring/ScoreSettings.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace the actual string literals in the code
    $content = $content -replace '"winRate"', '"win_rate"'
    $content = $content -replace '"profitFactor"', '"profit_factor"'
    $content = $content -replace '"maxDrawdown"', '"max_drawdown"'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreSettings.tsx" -ForegroundColor Green
}

# Fix ShareButton - sharingService returns {shareLink, shareId} not {share_link, share_id}
Write-Host "`nFixing ShareButton (use correct property names)..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # The service returns shareLink/shareId, so we need to use those
    $content = $content -replace '\.share_link\b', '.shareLink'
    $content = $content -replace '\.share_id\b', '.shareId'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
}

# Fix WeeklyPnL - WeeklyStat interface uses targetProgress not target_progress
Write-Host "`nFixing WeeklyPnL (use targetProgress)..."
$file = "src/components/WeeklyPnL.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # The WeeklyStat interface uses targetProgress
    $content = $content -replace '\.target_progress\b', '.targetProgress'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed WeeklyPnL.tsx" -ForegroundColor Green
}

# Fix TradeCalendar - still has 'date' references and WeeklyPnL import issues
Write-Host "`nFixing TradeCalendar..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix showForm.date to showForm.trade_date
    $content = $content -replace 'showForm\.date\b', 'showForm.trade_date'
    # Fix date= prop to trade_date=
    $content = $content -replace '\bdate=\{showForm\.trade_date\}', 'trade_date={showForm.trade_date}'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 9 fixed!" -ForegroundColor Cyan

