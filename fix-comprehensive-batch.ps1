# Comprehensive fix for remaining common errors

Write-Host "Fixing comprehensive batch of errors..." -ForegroundColor Cyan

# Fix LinkComponent - calendar_id and trade_type
Write-Host "`nFixing LinkComponent..."
$file = "src/components/common/RichTextEditor/components/LinkComponent.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.calendarId\b', '.calendar_id'
    $content = $content -replace '\.tradeId\b', '.trade_id'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed LinkComponent.tsx" -ForegroundColor Green
}

# Fix DayNotesDialog
Write-Host "Fixing DayNotesDialog..."
$file = "src/components/DayNotesDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.daysNotes', '.days_notes'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed DayNotesDialog.tsx" -ForegroundColor Green
}

# Fix MonthlyStatisticsSection
Write-Host "Fixing MonthlyStatisticsSection..."
$file = "src/components/MonthlyStatisticsSection.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\bmonthlyTarget\b', 'monthly_target'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed MonthlyStatisticsSection.tsx" -ForegroundColor Green
}

# Fix PerformanceCharts - isDeleted to deleted_at
Write-Host "Fixing PerformanceCharts deleted_at..."
$file = "src/components/PerformanceCharts.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Change isDeleted check to deleted_at check
    $content = $content -replace '!trade\.deleted_at', 'trade.deleted_at === null || trade.deleted_at === undefined'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed PerformanceCharts.tsx" -ForegroundColor Green
}

# Fix TradeDetailExpanded
Write-Host "Fixing TradeDetailExpanded..."
$file = "src/components/TradeDetailExpanded.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicEvents', '.economic_events'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeDetailExpanded.tsx" -ForegroundColor Green
}

# Fix WeeklyPnL
Write-Host "Fixing WeeklyPnL..."
$file = "src/components/WeeklyPnL.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.weeklyTarget', '.weekly_target'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed WeeklyPnL.tsx" -ForegroundColor Green
}

# Fix ScoreSection
Write-Host "Fixing ScoreSection..."
$file = "src/components/ScoreSection.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.scoreSettings', '.score_settings'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ScoreSection.tsx" -ForegroundColor Green
}

# Fix TradeForm
Write-Host "Fixing TradeForm..."
$file = "src/components/trades/TradeForm.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicEvents', '.economic_events'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeForm.tsx" -ForegroundColor Green
}

# Fix TradeFormDialog
Write-Host "Fixing TradeFormDialog..."
$file = "src/components/trades/TradeFormDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.economicEvents', '.economic_events'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeFormDialog.tsx" -ForegroundColor Green
}

Write-Host "`nAll comprehensive fixes applied!" -ForegroundColor Cyan

