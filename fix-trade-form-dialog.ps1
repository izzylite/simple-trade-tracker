# Fix TradeFormDialog - Replace date with trade_date and calendarId with calendar_id

Write-Host "Fixing TradeFormDialog..." -ForegroundColor Cyan

$file = "src/components/trades/TradeFormDialog.tsx"

if (Test-Path $file) {
    $content = Get-Content $file -Raw
    
    # Replace calendarId with calendar_id (but not in comments)
    $content = $content -replace '\bcalendarId\b', 'calendar_id'
    
    # Replace standalone 'date' with 'trade_date' (but not Date constructor or date-fns functions)
    # This is tricky - we need to be careful not to replace Date, endOfDay(date), etc.
    
    # Replace date in function parameters and variables
    $content = $content -replace '\(date,', '(trade_date,'
    $content = $content -replace '\(date\)', '(trade_date)'
    $content = $content -replace ', date\)', ', trade_date)'
    $content = $content -replace 'endOfDay\(date\)', 'endOfDay(trade_date)'
    $content = $content -replace 'calculateCumulativePnL\(date,', 'calculateCumulativePnL(trade_date,'
    
    # Replace riskToReward with risk_to_reward
    $content = $content -replace '\briskToReward\b', 'risk_to_reward'
    
    # Replace pendingImages with pending_images
    $content = $content -replace '\bpendingImages\b', 'pending_images'
    
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeFormDialog.tsx" -ForegroundColor Green
} else {
    Write-Host "  File not found: $file" -ForegroundColor Red
}

Write-Host "`nTradeFormDialog fixed!" -ForegroundColor Cyan

