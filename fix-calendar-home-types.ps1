# Fix CalendarHome.tsx type issues

Write-Host "Fixing CalendarHome.tsx types..."

$file = "src/components/CalendarHome.tsx"
$content = Get-Content $file -Raw

# Replace Calendar type with CalendarWithUIState in function parameters
$content = $content -replace '\(calendar: Calendar\)', '(calendar: CalendarWithUIState)'
$content = $content -replace 'calendar: Calendar\)', 'calendar: CalendarWithUIState)'

# Fix the updateCallback types
$content = $content -replace 'updateCallback: \(calendar: Calendar\) => Calendar', 'updateCallback: (calendar: CalendarWithUIState) => CalendarWithUIState'

# Fix selectedCalendarForCharts state type
$content = $content -replace 'useState<Calendar \| null>', 'useState<CalendarWithUIState | null>'

# Fix calendarToEdit and calendarToDuplicate state types
$content = $content -replace 'useState<Calendar \| undefined>', 'useState<CalendarWithUIState | undefined>'

Set-Content -Path $file -Value $content -NoNewline

Write-Host "Fixed CalendarHome.tsx" -ForegroundColor Green

