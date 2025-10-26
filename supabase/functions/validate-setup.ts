/**
 * Validate Edge Functions Development Environment Setup
 * Run with: deno run --allow-all validate-setup.ts
 */

import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts"

interface ValidationResult {
  category: string
  checks: Array<{
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
  }>
}

async function validateTools(): Promise<ValidationResult> {
  const checks = []
  
  // Check Deno version
  try {
    const denoVersion = Deno.version.deno
    checks.push({
      name: 'Deno Runtime',
      status: 'pass' as const,
      message: `Deno ${denoVersion} installed`
    })
  } catch {
    checks.push({
      name: 'Deno Runtime',
      status: 'fail' as const,
      message: 'Deno not available'
    })
  }
  
  // Check Supabase CLI
  try {
    const process = new Deno.Command('supabase', {
      args: ['--version'],
      stdout: 'piped',
      stderr: 'piped'
    })
    const { code, stdout } = await process.output()
    
    if (code === 0) {
      const version = new TextDecoder().decode(stdout).trim()
      checks.push({
        name: 'Supabase CLI',
        status: 'pass' as const,
        message: `Supabase CLI ${version} installed`
      })
    } else {
      checks.push({
        name: 'Supabase CLI',
        status: 'fail' as const,
        message: 'Supabase CLI not working'
      })
    }
  } catch {
    checks.push({
      name: 'Supabase CLI',
      status: 'fail' as const,
      message: 'Supabase CLI not found'
    })
  }
  
  return { category: 'Development Tools', checks }
}

async function validateDirectoryStructure(): Promise<ValidationResult> {
  const checks = []
  
  const requiredDirs = [
    '_shared',
    'handle-trade-changes',
    'cleanup-deleted-calendar',
    'update-tag',
    'process-economic-events',
    'refresh-economic-calendar',
    'cleanup-expired-calendars',
    'auto-refresh-economic-calendar',
    'generate-trade-share-link',
    'get-shared-trade',
    'deactivate-shared-trade',
    'generate-calendar-share-link',
    'get-shared-calendar',
    'deactivate-shared-calendar'
  ]
  
  for (const dir of requiredDirs) {
    const exists = existsSync(dir)
    checks.push({
      name: `Directory: ${dir}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? 'Directory exists' : 'Directory missing'
    })
  }
  
  return { category: 'Directory Structure', checks }
}

async function validateSharedUtilities(): Promise<ValidationResult> {
  const checks = []
  
  const sharedFiles = [
    { file: '_shared/supabase.ts', name: 'Supabase utilities' },
    { file: '_shared/types.ts', name: 'Type definitions' },
    { file: '_shared/utils.ts', name: 'Business logic utilities' }
  ]
  
  for (const { file, name } of sharedFiles) {
    const exists = existsSync(file)
    checks.push({
      name,
      status: exists ? 'pass' : 'fail',
      message: exists ? 'File exists' : 'File missing'
    })
    
    if (exists) {
      try {
        await import(`./${file}`)
        checks.push({
          name: `${name} (import)`,
          status: 'pass' as const,
          message: 'Imports successfully'
        })
      } catch (error) {
        checks.push({
          name: `${name} (import)`,
          status: 'fail' as const,
          message: `Import failed: ${error.message}`
        })
      }
    }
  }
  
  return { category: 'Shared Utilities', checks }
}

async function validateEnvironment(): Promise<ValidationResult> {
  const checks = []
  
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  for (const envVar of requiredEnvVars) {
    const value = Deno.env.get(envVar)
    checks.push({
      name: envVar,
      status: value ? 'pass' : 'warn',
      message: value ? 'Set' : 'Not set (required for deployment)'
    })
  }
  
  // Check for .env.example
  const envExampleExists = existsSync('.env.example')
  checks.push({
    name: 'Environment template',
    status: envExampleExists ? 'pass' : 'warn',
    message: envExampleExists ? '.env.example exists' : '.env.example missing'
  })
  
  return { category: 'Environment Configuration', checks }
}

async function validateDocumentation(): Promise<ValidationResult> {
  const checks = []
  
  const docs = [
    { file: 'README.md', name: 'Setup documentation' },
    { file: '../../../docs/firebase-functions-inventory.md', name: 'Function inventory' },
    { file: '../../../docs/firebase-functions-analysis.md', name: 'Function analysis' },
    { file: '../../../docs/firebase-to-supabase-mapping.md', name: 'Migration mapping' }
  ]
  
  for (const { file, name } of docs) {
    const exists = existsSync(file)
    checks.push({
      name,
      status: exists ? 'pass' : 'warn',
      message: exists ? 'Documentation exists' : 'Documentation missing'
    })
  }
  
  return { category: 'Documentation', checks }
}

function printResults(results: ValidationResult[]) {
  console.log('🔍 Edge Functions Environment Validation\n')
  
  let totalChecks = 0
  let passedChecks = 0
  let failedChecks = 0
  let warnings = 0
  
  for (const result of results) {
    console.log(`📋 ${result.category}`)
    console.log('─'.repeat(50))
    
    for (const check of result.checks) {
      totalChecks++
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️'
      console.log(`${icon} ${check.name}: ${check.message}`)
      
      if (check.status === 'pass') passedChecks++
      else if (check.status === 'fail') failedChecks++
      else warnings++
    }
    console.log()
  }
  
  console.log('📊 Summary')
  console.log('─'.repeat(50))
  console.log(`Total checks: ${totalChecks}`)
  console.log(`✅ Passed: ${passedChecks}`)
  console.log(`❌ Failed: ${failedChecks}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  
  if (failedChecks === 0) {
    console.log('\n🎉 Environment setup is ready for Edge Functions development!')
    return true
  } else {
    console.log('\n🔧 Please fix the failed checks before proceeding.')
    return false
  }
}

async function main() {
  const results = await Promise.all([
    validateTools(),
    validateDirectoryStructure(),
    validateSharedUtilities(),
    validateEnvironment(),
    validateDocumentation()
  ])
  
  const success = printResults(results)
  Deno.exit(success ? 0 : 1)
}

if (import.meta.main) {
  main()
}
