# Fix all NewTradeForm and PendingImage references to use snake_case

Write-Host "Converting NewTradeForm and PendingImage to snake_case..." -ForegroundColor Cyan

# Fix TradeForm.tsx
Write-Host "`nFixing TradeForm.tsx..."
$file = "src/components/trades/TradeForm.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix all property access on newTrade
    $content = $content -replace '\.type\b', '.trade_type'
    $content = $content -replace '\.entry\b', '.entry_price'
    $content = $content -replace '\.exit\b', '.exit_price'
    $content = $content -replace '\.date\b', '.trade_date'
    $content = $content -replace '\.riskToReward\b', '.risk_to_reward'
    $content = $content -replace '\.partialsTaken\b', '.partials_taken'
    $content = $content -replace '\.pendingImages\b', '.pending_images'
    $content = $content -replace '\.uploadedImages\b', '.uploaded_images'
    $content = $content -replace '\.isTemporary\b', '.is_temporary'
    $content = $content -replace '\.economicEvents\b', '.economic_events'
    $content = $content -replace '\.columnWidth\b', '.column_width'
    $content = $content -replace '\.uploadProgress\b', '.upload_progress'
    # Fix object property names
    $content = $content -replace '\btype:', 'trade_type:'
    $content = $content -replace '\bentry:', 'entry_price:'
    $content = $content -replace '\bexit:', 'exit_price:'
    $content = $content -replace '\bdate:', 'trade_date:'
    $content = $content -replace '\briskToReward:', 'risk_to_reward:'
    $content = $content -replace '\bpartialsTaken:', 'partials_taken:'
    $content = $content -replace '\bpendingImages:', 'pending_images:'
    $content = $content -replace '\buploadedImages:', 'uploaded_images:'
    $content = $content -replace '\bisTemporary:', 'is_temporary:'
    $content = $content -replace '\beconomicEvents:', 'economic_events:'
    $content = $content -replace '\bcolumnWidth:', 'column_width:'
    $content = $content -replace '\buploadProgress:', 'upload_progress:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeForm.tsx" -ForegroundColor Green
}

# Fix TradeFormDialog.tsx
Write-Host "Fixing TradeFormDialog.tsx..."
$file = "src/components/trades/TradeFormDialog.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    # Fix all property access
    $content = $content -replace '\.type\b', '.trade_type'
    $content = $content -replace '\.entry\b', '.entry_price'
    $content = $content -replace '\.exit\b', '.exit_price'
    $content = $content -replace '\.date\b', '.trade_date'
    $content = $content -replace '\.riskToReward\b', '.risk_to_reward'
    $content = $content -replace '\.partialsTaken\b', '.partials_taken'
    $content = $content -replace '\.pendingImages\b', '.pending_images'
    $content = $content -replace '\.uploadedImages\b', '.uploaded_images'
    $content = $content -replace '\.isTemporary\b', '.is_temporary'
    $content = $content -replace '\.economicEvents\b', '.economic_events'
    $content = $content -replace '\.columnWidth\b', '.column_width'
    $content = $content -replace '\.uploadProgress\b', '.upload_progress'
    # Fix object property names
    $content = $content -replace '\btype:', 'trade_type:'
    $content = $content -replace '\bentry:', 'entry_price:'
    $content = $content -replace '\bexit:', 'exit_price:'
    $content = $content -replace '\bdate:', 'trade_date:'
    $content = $content -replace '\briskToReward:', 'risk_to_reward:'
    $content = $content -replace '\bpartialsTaken:', 'partials_taken:'
    $content = $content -replace '\bpendingImages:', 'pending_images:'
    $content = $content -replace '\buploadedImages:', 'uploaded_images:'
    $content = $content -replace '\bisTemporary:', 'is_temporary:'
    $content = $content -replace '\beconomicEvents:', 'economic_events:'
    $content = $content -replace '\bcolumnWidth:', 'column_width:'
    $content = $content -replace '\buploadProgress:', 'upload_progress:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed TradeFormDialog.tsx" -ForegroundColor Green
}

# Fix ImageUploader.tsx
Write-Host "Fixing ImageUploader.tsx..."
$file = "src/components/trades/ImageUploader.tsx"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    $content = $content -replace '\.columnWidth\b', '.column_width'
    $content = $content -replace '\.uploadProgress\b', '.upload_progress'
    $content = $content -replace '\bcolumnWidth:', 'column_width:'
    $content = $content -replace '\buploadProgress:', 'upload_progress:'
    Set-Content -Path $file -Value $content -NoNewline
    Write-Host "  Fixed ImageUploader.tsx" -ForegroundColor Green
}

Write-Host "`nNewTradeForm and PendingImage conversion complete!" -ForegroundColor Cyan

