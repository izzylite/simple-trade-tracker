# Fix Economic Calendar and related components

Write-Host "Fixing Economic Calendar components..." -ForegroundColor Cyan

# Note: EconomicEvent has 'date' property, not 'trade_date'
# The errors are because components are trying to access 'trade_date' on EconomicEvent

Write-Host "`nNote: EconomicEvent uses 'date' property, not 'trade_date'" -ForegroundColor Yellow
Write-Host "These errors need manual review to determine correct property access" -ForegroundColor Yellow

# Fix ScoreHistory - it should use 'date' not 'trade_date'
Write-Host "`nFixing ScoreHistory..."
$file = "src/components/scoring/ScoreHistory.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # ScoreHistory has 'date' property, not 'trade_date'
    $content = $content -replace '\.trade_date', '.date'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreHistory.tsx" -ForegroundColor Green
}

Write-Host "`nEconomic Calendar fixes require manual review!" -ForegroundColor Cyan

