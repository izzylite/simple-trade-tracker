# Setup Firestore Vector Index for Trade Embeddings
# PowerShell script for Windows users

param(
    [string]$ProjectId = "",
    [string]$Database = "(default)"
)

# Configuration
$Config = @{
    CollectionGroup = "trade-embeddings"
    VectorField = "embedding"
    Dimension = 768
    Database = $Database
}

function Test-GCloudInstalled {
    try {
        $null = Get-Command gcloud -ErrorAction Stop
        Write-Host "✅ Google Cloud CLI is installed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Google Cloud CLI is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install it from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
        return $false
    }
}

function Test-GCloudAuth {
    try {
        $result = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
        
        if ($result) {
            Write-Host "✅ Google Cloud CLI is authenticated" -ForegroundColor Green
            Write-Host "   Active account: $result" -ForegroundColor Gray
            return $true
        }
        else {
            Write-Host "❌ Google Cloud CLI is not authenticated" -ForegroundColor Red
            Write-Host "Please run: gcloud auth login" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "❌ Error checking authentication: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Get-FirebaseProject {
    # Try to read from .firebaserc
    $firebaseRcPath = Join-Path $PWD ".firebaserc"
    if (Test-Path $firebaseRcPath) {
        try {
            $firebaseRc = Get-Content $firebaseRcPath | ConvertFrom-Json
            $projectId = $firebaseRc.projects.default
            if ($projectId) {
                Write-Host "✅ Found Firebase project: $projectId" -ForegroundColor Green
                return $projectId
            }
        }
        catch {
            # Continue to next method
        }
    }

    # Try to get from gcloud config
    try {
        $result = gcloud config get-value project 2>$null
        
        if ($result -and $result -ne "(unset)") {
            Write-Host "✅ Using gcloud project: $result" -ForegroundColor Green
            return $result
        }
    }
    catch {
        # Continue to error
    }

    Write-Host "❌ Could not determine Firebase project ID" -ForegroundColor Red
    Write-Host "Please ensure you have a .firebaserc file or set gcloud project:" -ForegroundColor Yellow
    Write-Host "   gcloud config set project YOUR_PROJECT_ID" -ForegroundColor Yellow
    return $null
}

function New-VectorIndex {
    param([string]$ProjectId)
    
    Write-Host "`n🔧 Creating Firestore vector index..." -ForegroundColor Blue
    
    $command = @(
        "gcloud", "firestore", "indexes", "composite", "create",
        "--project=$ProjectId",
        "--collection-group=$($Config.CollectionGroup)",
        "--query-scope=COLLECTION",
        "--field-config=field-path=calendarId,order=ASCENDING",
        "--field-config=field-path=$($Config.VectorField),vector-config='{`"dimension`":`"$($Config.Dimension)`", `"flat`": `"{}`"}'",
        "--database=$($Config.Database)"
    )
    
    Write-Host "Running command:" -ForegroundColor Gray
    Write-Host ($command -join " ") -ForegroundColor Gray
    
    try {
        & $command[0] $command[1..($command.Length-1)]
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Vector index creation initiated successfully!" -ForegroundColor Green
            Write-Host "📝 Note: Index creation may take several minutes to complete." -ForegroundColor Yellow
            Write-Host "   You can check the status in the Firebase Console under Firestore > Indexes" -ForegroundColor Yellow
            return $true
        }
        else {
            Write-Host "`n❌ Failed to create vector index (exit code: $LASTEXITCODE)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "`n❌ Failed to create vector index: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Message -like "*already exists*") {
            Write-Host "💡 The index might already exist. Check the Firebase Console." -ForegroundColor Yellow
        }
        elseif ($_.Exception.Message -like "*permission*") {
            Write-Host "💡 Make sure you have the necessary permissions for this project." -ForegroundColor Yellow
        }
        
        return $false
    }
}

function Get-ExistingIndexes {
    param([string]$ProjectId)
    
    Write-Host "`n📋 Checking existing indexes..." -ForegroundColor Blue
    
    try {
        $result = gcloud firestore indexes composite list --project=$ProjectId --database=$($Config.Database) 2>$null
        
        if ($result -like "*$($Config.CollectionGroup)*" -and $result -like "*$($Config.VectorField)*") {
            Write-Host "✅ Vector index for trade-embeddings already exists!" -ForegroundColor Green
            return $true
        }
        else {
            Write-Host "ℹ️  No existing vector index found for trade-embeddings" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "⚠️  Could not check existing indexes: $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
}

function Main {
    Write-Host "🚀 Setting up Firestore Vector Index for AI Chat Optimization`n" -ForegroundColor Cyan
    
    # Check prerequisites
    if (-not (Test-GCloudInstalled)) {
        exit 1
    }
    
    if (-not (Test-GCloudAuth)) {
        exit 1
    }
    
    $projectId = if ($ProjectId) { $ProjectId } else { Get-FirebaseProject }
    if (-not $projectId) {
        exit 1
    }
    
    # Check if index already exists
    if (Get-ExistingIndexes -ProjectId $projectId) {
        Write-Host "`n🎉 Setup complete! Vector index is ready to use." -ForegroundColor Green
        exit 0
    }
    
    # Create the index
    if (New-VectorIndex -ProjectId $projectId) {
        Write-Host "`n🎉 Setup initiated successfully!" -ForegroundColor Green
        Write-Host "`n📚 Next steps:" -ForegroundColor Cyan
        Write-Host "1. Wait for index creation to complete (check Firebase Console)" -ForegroundColor White
        Write-Host "2. Test the AI chat with vector search enabled" -ForegroundColor White
        Write-Host "3. Monitor token usage reduction in browser dev tools" -ForegroundColor White
    }
    else {
        Write-Host "`n❌ Setup failed. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
}

# Run the main function
Main
