# Fix remaining TypeScript errors

Write-Host "Fixing remaining errors..."

# Fix CalendarFormDialog - hero image properties
Write-Host "Fixing CalendarFormDialog hero image properties..."
$file = "src/components/CalendarFormDialog.tsx"
$content = Get-Content $file -Raw
$content = $content -replace '\bheroImageUrl\b', 'hero_image_url'
$content = $content -replace '\bheroImageAttribution\b', 'hero_image_attribution'
Set-Content -Path $file -Value $content -NoNewline
Write-Host "  Fixed CalendarFormDialog.tsx" -ForegroundColor Green

# Fix CalendarHome - hero image properties
Write-Host "Fixing CalendarHome hero image properties..."
$file = "src/components/CalendarHome.tsx"
$content = Get-Content $file -Raw
$content = $content -replace '\.heroImageUrl', '.hero_image_url'
$content = $content -replace '\.heroImageAttribution', '.hero_image_attribution'
Set-Content -Path $file -Value $content -NoNewline
Write-Host "  Fixed CalendarHome.tsx" -ForegroundColor Green

# Fix CumulativePnLChart - monthly_target
Write-Host "Fixing CumulativePnLChart monthly_target..."
$file = "src/components/charts/CumulativePnLChart.tsx"
$content = Get-Content $file -Raw
$content = $content -replace '\bmonthlyTarget\b', 'monthly_target'
Set-Content -Path $file -Value $content -NoNewline
Write-Host "  Fixed CumulativePnLChart.tsx" -ForegroundColor Green

# Fix PnLChartsWrapper - monthly_target
Write-Host "Fixing PnLChartsWrapper monthly_target..."
$file = "src/components/charts/PnLChartsWrapper.tsx"
$content = Get-Content $file -Raw
$content = $content -replace '\bmonthlyTarget\b', 'monthly_target'
Set-Content -Path $file -Value $content -NoNewline
Write-Host "  Fixed PnLChartsWrapper.tsx" -ForegroundColor Green

# Fix TradesListDialog - total_trades
Write-Host "Fixing TradesListDialog total_trades..."
$file = "src/components/charts/TradesListDialog.tsx"
$content = Get-Content $file -Raw
$content = $content -replace '\.total_trades', '.totalTrades'
Set-Content -Path $file -Value $content -NoNewline
Write-Host "  Fixed TradesListDialog.tsx" -ForegroundColor Green

Write-Host "`nAll fixes applied!" -ForegroundColor Cyan

