# Fix CalendarStats properties - convert stats.total_pnl to stats.totalPnL

Write-Host "Fixing CalendarStats properties..."

$files = @(
    "src/components/CalendarCard.tsx",
    "src/components/CalendarHome.tsx",
    "src/components/charts/TradesListDialog.tsx",
    "src/components/charts/WinLossDistribution.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file"
        $content = Get-Content $file -Raw
        $content = $content -replace 'stats\.total_pnl', 'stats.totalPnL'
        $content = $content -replace 'stats\.growth_percentage', 'stats.growthPercentage'
        $content = $content -replace 'stats\.initial_balance', 'stats.initialBalance'
        $content = $content -replace 'stats\.current_balance', 'stats.currentBalance'
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "  Fixed: $file" -ForegroundColor Green
    }
}

Write-Host "Done!" -ForegroundColor Cyan

