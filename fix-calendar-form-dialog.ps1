# Fix CalendarFormDialog variable names

Write-Host "Fixing CalendarFormDialog.tsx..."

$file = "src/components/CalendarFormDialog.tsx"
$content = Get-Content $file -Raw

# Replace variable references
$content = $content -replace '\baccountBalance\b', 'account_balance'
$content = $content -replace '\bmaxDailyDrawdown\b', 'max_daily_drawdown'
$content = $content -replace '\bweeklyTarget\b', 'weekly_target'
$content = $content -replace '\bmonthlyTarget\b', 'monthly_target'
$content = $content -replace '\byearlyTarget\b', 'yearly_target'
$content = $content -replace '\briskPerTrade\b', 'risk_per_trade'

# Fix setter function names
$content = $content -replace 'setAccountBalance', 'setAccount_balance'
$content = $content -replace 'setMaxDailyDrawdown', 'setMax_daily_drawdown'
$content = $content -replace 'setWeeklyTarget', 'setWeekly_target'
$content = $content -replace 'setMonthlyTarget', 'setMonthly_target'
$content = $content -replace 'setYearlyTarget', 'setYearly_target'
$content = $content -replace 'setRiskPerTrade', 'setRisk_per_trade'

Set-Content -Path $file -Value $content -NoNewline

Write-Host "Fixed CalendarFormDialog.tsx" -ForegroundColor Green

