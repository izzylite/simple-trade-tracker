# Deploy process-economic-events edge function to Supabase
# This script uses the Supabase CLI to deploy the function

Write-Host "🚀 Deploying process-economic-events edge function..." -ForegroundColor Cyan

# Check if Supabase CLI is available
$supabaseCli = Get-Command "npx" -ErrorAction SilentlyContinue
if (-not $supabaseCli) {
    Write-Host "❌ npx not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

# Deploy the function
Write-Host "📦 Deploying function..." -ForegroundColor Yellow
$deployOutput = npx supabase functions deploy process-economic-events --project-ref gwubzauelilziaqnsfac 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host $deployOutput
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host $deployOutput
    Write-Host "`n💡 Try deploying manually via Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "   1. Go to https://supabase.com/dashboard" -ForegroundColor White
    Write-Host "   2. Select your project" -ForegroundColor White
    Write-Host "   3. Navigate to Edge Functions → process-economic-events" -ForegroundColor White
    Write-Host "   4. Deploy the updated function" -ForegroundColor White
    exit 1
}

