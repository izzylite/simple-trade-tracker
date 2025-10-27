#!/bin/bash

# Supabase Edge Functions Deployment Script
# Deploys all migrated Firebase Cloud Functions to Supabase Edge Functions

set -e  # Exit on any error

echo "🚀 Starting Supabase Edge Functions Deployment"
echo "=============================================="

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    echo "   Visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if Deno is available
if ! command -v deno &> /dev/null; then
    echo "❌ Deno not found. Please install it first."
    echo "   Visit: https://deno.land/manual/getting_started/installation"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# List of all functions to deploy
FUNCTIONS=(
    "handle-trade-changes"
    "cleanup-deleted-calendar"
    "update-tag"
    "process-economic-events"
    "refresh-economic-calendar"
    "cleanup-expired-calendars"
    "auto-refresh-economic-calendar"
    "get-shared-trade"
    "get-shared-calendar"
)

echo "📋 Functions to deploy: ${#FUNCTIONS[@]}"
for func in "${FUNCTIONS[@]}"; do
    echo "   - $func"
done
echo ""

# Validate all functions exist
echo "🔍 Validating function directories..."
for func in "${FUNCTIONS[@]}"; do
    if [ ! -d "$func" ]; then
        echo "❌ Function directory not found: $func"
        exit 1
    fi
    
    if [ ! -f "$func/index.ts" ]; then
        echo "❌ Function index.ts not found: $func/index.ts"
        exit 1
    fi
    
    echo "   ✅ $func"
done
echo ""

# Check if user wants to deploy all functions or specific ones
if [ "$1" = "--function" ] && [ -n "$2" ]; then
    # Deploy specific function
    FUNCTION_NAME="$2"
    if [[ ! " ${FUNCTIONS[@]} " =~ " ${FUNCTION_NAME} " ]]; then
        echo "❌ Unknown function: $FUNCTION_NAME"
        echo "Available functions: ${FUNCTIONS[*]}"
        exit 1
    fi
    
    echo "🎯 Deploying specific function: $FUNCTION_NAME"
    FUNCTIONS=("$FUNCTION_NAME")
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage:"
    echo "  ./deploy.sh                    # Deploy all functions"
    echo "  ./deploy.sh --function <name>  # Deploy specific function"
    echo "  ./deploy.sh --help            # Show this help"
    echo ""
    echo "Available functions:"
    for func in "${FUNCTIONS[@]}"; do
        echo "  - $func"
    done
    exit 0
fi

# Set environment variables if .env file exists
if [ -f ".env" ]; then
    echo "🔧 Setting environment variables from .env file..."
    supabase secrets set --env-file .env
    echo "   ✅ Environment variables set"
else
    echo "⚠️  No .env file found. Make sure environment variables are set in Supabase dashboard."
fi
echo ""

# Deploy functions
DEPLOYED_COUNT=0
FAILED_COUNT=0
FAILED_FUNCTIONS=()

for func in "${FUNCTIONS[@]}"; do
    echo "📦 Deploying function: $func"
    
    if supabase functions deploy "$func" --no-verify-jwt; then
        echo "   ✅ $func deployed successfully"
        ((DEPLOYED_COUNT++))
    else
        echo "   ❌ $func deployment failed"
        ((FAILED_COUNT++))
        FAILED_FUNCTIONS+=("$func")
    fi
    echo ""
done

# Summary
echo "📊 Deployment Summary"
echo "===================="
echo "✅ Successfully deployed: $DEPLOYED_COUNT"
echo "❌ Failed deployments: $FAILED_COUNT"

if [ $FAILED_COUNT -gt 0 ]; then
    echo ""
    echo "Failed functions:"
    for func in "${FAILED_FUNCTIONS[@]}"; do
        echo "   - $func"
    done
    echo ""
    echo "💡 Tips for troubleshooting:"
    echo "   1. Check function syntax with: deno check $func/index.ts"
    echo "   2. Verify environment variables are set"
    echo "   3. Check Supabase project connection: supabase status"
    echo "   4. Review function logs in Supabase dashboard"
fi

echo ""
echo "🎉 Deployment process completed!"

if [ $FAILED_COUNT -eq 0 ]; then
    echo "✅ All functions deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Set up database triggers (see setup-triggers.sql)"
    echo "2. Configure cron jobs (see setup-cron.sql)"
    echo "3. Test functions in Supabase dashboard"
    echo "4. Update client code to use new endpoints"
    exit 0
else
    echo "⚠️  Some functions failed to deploy. Please check the errors above."
    exit 1
fi
