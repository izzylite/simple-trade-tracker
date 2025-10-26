# Fix batch 7 - Component prop interfaces and property names

Write-Host "Fixing batch 7..." -ForegroundColor Cyan

# Fix DayHeader and DayDialog - prop interfaces
Write-Host "`nFixing DayHeader and DayDialog prop interfaces..."
$files = @(
    "src/components/trades/DayHeader.tsx",
    "src/components/trades/DayDialog.tsx",
    "src/components/charts/TradesListDialog.tsx",
    "src/components/trades/TradeFormDialog.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        # Fix prop names
        $content = $content -replace '\baccountBalance\b', 'account_balance'
        $content = $content -replace '\btotalPnL\b', 'total_pnl'
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  Fixed $file" -ForegroundColor Green
    }
}

# Fix ScoreSettings - already fixed but double check
Write-Host "`nFixing ScoreSettings..."
$file = "src/components/scoring/ScoreSettings.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # These should already be fixed, but ensure they are
    if ($content -match '"winRate"' -or $content -match '"profitFactor"' -or $content -match '"maxDrawdown"') {
        $content = $content -replace '"winRate"', '"win_rate"'
        $content = $content -replace '"profitFactor"', '"profit_factor"'
        $content = $content -replace '"maxDrawdown"', '"max_drawdown"'
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  Fixed ScoreSettings.tsx" -ForegroundColor Green
    } else {
        Write-Host "  ScoreSettings.tsx already correct" -ForegroundColor Green
    }
}

# Fix ShareButton - shareLink to share_link, shareId to share_id
Write-Host "`nFixing ShareButton..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.shareLink\b', '.share_link'
    $content = $content -replace '\.shareId\b', '.share_id'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ShareButton.tsx" -ForegroundColor Green
}

# Fix SharedTradeView - remove 'date' property
Write-Host "`nFixing SharedTradeView..."
$file = "src/components/sharing/SharedTradeView.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Remove 'date: Date,' line
    $content = $content -replace '\s*date:\s*Date,\s*\n', "`n"
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedTradeView.tsx" -ForegroundColor Green
}

# Fix WeeklyPnL - targetProgress to target_progress
Write-Host "`nFixing WeeklyPnL..."
$file = "src/components/WeeklyPnL.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.targetProgress\b', '.target_progress'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed WeeklyPnL.tsx" -ForegroundColor Green
}

# Fix TradeDetailExpanded - columnWidth to column_width
Write-Host "`nFixing TradeDetailExpanded..."
$file = "src/components/TradeDetailExpanded.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.columnWidth\b', '.column_width'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeDetailExpanded.tsx" -ForegroundColor Green
}

# Fix AI functions - economicEvents to economic_events
Write-Host "`nFixing AI functions..."
$aiFiles = @(
    "src/services/ai/functions/dataConversion.ts",
    "src/services/ai/functions/economicEvents.ts",
    "src/services/ai/functions/getTradeStatistics.ts",
    "src/services/ai/functions/searchTrades.ts"
)

foreach ($file in $aiFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace '\.economicEvents\b', '.economic_events'
        $content = $content -replace '\.riskToReward\b', '.risk_to_reward'
        $content = $content -replace '\.partialsTaken\b', '.partials_taken'
        $content = $content -replace '\.date\b(?!\()', '.trade_date'
        $content = $content -replace '\.type\b(?!of)', '.trade_type'
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  Fixed $file" -ForegroundColor Green
    }
}

# Fix firebaseAIChatService - economicCalendarFilters
Write-Host "`nFixing firebaseAIChatService..."
$file = "src/services/ai/firebaseAIChatService.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicCalendarFilters\b', '.economic_calendar_filters'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed firebaseAIChatService.ts" -ForegroundColor Green
}

Write-Host "`nBatch 7 fixed!" -ForegroundColor Cyan

