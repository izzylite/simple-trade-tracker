# Fix batch 12 - Production code errors (non-test files)

Write-Host "Fixing batch 12 - Production code..." -ForegroundColor Cyan

# Fix EconomicCalendarDrawer - EconomicEvent uses 'date' not 'trade_date'
Write-Host "`nFixing EconomicCalendarDrawer (EconomicEvent.date)..."
$file = "src/components/economicCalendar/EconomicCalendarDrawer.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace trade_date with date for EconomicEvent
    $content = $content -replace 'event\.trade_date', 'event.date'
    $content = $content -replace 'day\.trade_date', 'day.date'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed EconomicCalendarDrawer.tsx" -ForegroundColor Green
}

# Fix useHighImpactEvents - EconomicEvent uses 'date' not 'trade_date'
Write-Host "`nFixing useHighImpactEvents (EconomicEvent.date)..."
$file = "src/hooks/useHighImpactEvents.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace trade_date with date for EconomicEvent
    $content = $content -replace 'event\.trade_date', 'event.date'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed useHighImpactEvents.ts" -ForegroundColor Green
}

# Fix DayNotesDialog - Convert Record to Map
Write-Host "`nFixing DayNotesDialog (Record to Map)..."
$file = "src/components/DayNotesDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace new Map(notes) with Object.entries(notes).reduce((map, [k, v]) => map.set(k, v), new Map())
    $content = $content -replace 'new Map\(notes\)', 'Object.entries(notes).reduce((map, [k, v]) => map.set(k, v), new Map<string, string>())'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed DayNotesDialog.tsx" -ForegroundColor Green
}

# Fix SharedCalendarPage - Convert Record to Map
Write-Host "`nFixing SharedCalendarPage (Record to Map)..."
$file = "src/components/sharing/SharedCalendarPage.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace new Map(calendar.day_notes) with Object.entries conversion
    $content = $content -replace 'dayNotes=\{calendar\.day_notes\}', 'dayNotes={calendar.day_notes ? Object.entries(calendar.day_notes).reduce((map, [k, v]) => map.set(k, v), new Map<string, string>()) : new Map<string, string>()}'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed SharedCalendarPage.tsx" -ForegroundColor Green
}

# Fix App.tsx - Convert Record to Map
Write-Host "`nFixing App.tsx (Record to Map)..."
$file = "src/App.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Replace dayNotes={calendar.day_notes} with conversion
    $content = $content -replace 'dayNotes=\{calendar\.day_notes\}', 'dayNotes={calendar.day_notes ? Object.entries(calendar.day_notes).reduce((map, [k, v]) => map.set(k, v), new Map<string, string>()) : new Map<string, string>()}'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed App.tsx" -ForegroundColor Green
}

Write-Host "`nBatch 12 production fixes complete!" -ForegroundColor Cyan

