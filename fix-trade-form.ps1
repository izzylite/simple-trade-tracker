# Fix TradeForm - NewTradeForm uses camelCase

Write-Host "Fixing TradeForm..." -ForegroundColor Cyan

$file = "src/components/trades/TradeForm.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix property access on NewTradeForm
    $content = $content -replace '\brequired_tag_groups\b', 'requiredTagGroups'
    $content = $content -replace '\.risk_to_reward', '.riskToReward'
    $content = $content -replace '\.partials_taken', '.partialsTaken'
    $content = $content -replace '\.entry_price', '.entry'
    $content = $content -replace '\.exit_price', '.exit'
    $content = $content -replace '\.trade_date', '.date'
    $content = $content -replace '\.trade_type', '.type'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeForm.tsx" -ForegroundColor Green
}

Write-Host "`nTradeForm fixes applied!" -ForegroundColor Cyan

