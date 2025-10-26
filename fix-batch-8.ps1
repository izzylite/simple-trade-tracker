# Fix batch 8 - Prop interfaces and component property names

Write-Host "Fixing batch 8..." -ForegroundColor Cyan

# Fix MonthlyStatisticsSection and PerformanceCharts - monthly_target prop
Write-Host "`nFixing MonthlyStatisticsSection and PerformanceCharts..."
$files = @(
    "src/components/MonthlyStatisticsSection.tsx",
    "src/components/TradeCalendar.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        # Fix prop names in JSX
        $content = $content -replace '\bmonthlyTarget=', 'monthly_target='
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  Fixed $file" -ForegroundColor Green
    }
}

# Fix ScoreSettings - string literals
Write-Host "`nFixing ScoreSettings string literals..."
$file = "src/components/scoring/ScoreSettings.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix the string literals in function calls
    $content = $content -replace 'getMetricValue\("winRate"\)', 'getMetricValue("win_rate")'
    $content = $content -replace 'getMetricValue\("profitFactor"\)', 'getMetricValue("profit_factor")'
    $content = $content -replace 'getMetricValue\("maxDrawdown"\)', 'getMetricValue("max_drawdown")'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreSettings.tsx" -ForegroundColor Green
}

# Fix ShareButton - return type from sharingService
Write-Host "`nFixing ShareButton..."
$file = "src/components/sharing/ShareButton.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # The issue is that sharingService returns {shareLink, shareId, directLink}
    # but the code expects {share_link, share_id, directLink}
    # We need to check what sharingService actually returns
    Write-Host "  ShareButton needs manual fix - check sharingService return type" -ForegroundColor Yellow
}

# Fix SharedTradeView - still has 'date' property
Write-Host "`nFixing SharedTradeView..."
$file = "src/components/sharing/SharedTradeView.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Remove any remaining 'date:' assignments
    $content = $content -replace ',\s*date:\s*[^,}]+', ''
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedTradeView.tsx" -ForegroundColor Green
}

# Fix WeeklyPnL - targetProgress
Write-Host "`nFixing WeeklyPnL..."
$file = "src/components/WeeklyPnL.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Already fixed in previous script, but double check
    if ($content -match '\.targetProgress\b') {
        $content = $content -replace '\.targetProgress\b', '.target_progress'
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  Fixed WeeklyPnL.tsx" -ForegroundColor Green
    } else {
        Write-Host "  WeeklyPnL.tsx already correct" -ForegroundColor Green
    }
}

Write-Host "`nBatch 8 fixed!" -ForegroundColor Cyan

