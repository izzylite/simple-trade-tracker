# Fix batch 10 - Final component fixes

Write-Host "Fixing batch 10..." -ForegroundColor Cyan

# Fix MonthlyStatisticsSection - monthly_target to monthlyTarget
Write-Host "`nFixing MonthlyStatisticsSection..."
$file = "src/components/MonthlyStatisticsSection.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix prop name in JSX
    $content = $content -replace '\bmonthly_target=', 'monthlyTarget='
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed MonthlyStatisticsSection.tsx" -ForegroundColor Green
}

# Fix TradeCalendar - monthly_target to monthlyTarget in component calls
Write-Host "`nFixing TradeCalendar (monthly_target props)..."
$file = "src/components/TradeCalendar.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix prop names in JSX - but only in component calls, not in variable names
    $content = $content -replace 'monthly_target=\{monthly_target\}', 'monthlyTarget={monthly_target}'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeCalendar.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 10 fixed!" -ForegroundColor Cyan

