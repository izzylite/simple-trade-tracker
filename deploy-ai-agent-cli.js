#!/usr/bin/env node

/**
 * Deploy AI Trading Agent using Supabase CLI with proper environment setup
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_REF = 'gwubzauelilziaqnsfac';
const FUNCTION_NAME = 'ai-trading-agent';
const ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';

console.log('🚀 Deploying AI Trading Agent...\n');

try {
  // Set environment variables for the CLI
  const env = {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN,
  };

  console.log(`📦 Deploying function: ${FUNCTION_NAME}`);
  console.log(`📍 Project: ${PROJECT_REF}\n`);

  // Run the deploy command
  const command = `npx supabase functions deploy ${FUNCTION_NAME} --project-ref ${PROJECT_REF}`;
  
  console.log(`Running: ${command}\n`);
  
  const output = execSync(command, {
    cwd: __dirname,
    env: env,
    stdio: 'inherit',
  });

  console.log('\n✅ Deployment successful!');
  console.log('\n📋 Next Steps:');
  console.log('1. Set environment secrets:');
  console.log('   npx supabase secrets set OPENAI_API_KEY=your_key_here --project-ref ' + PROJECT_REF);
  console.log('   npx supabase secrets set AGENT_SUPABASE_ACCESS_TOKEN=' + ACCESS_TOKEN + ' --project-ref ' + PROJECT_REF);
  console.log('   npx supabase secrets set SERPER_API_KEY=your_key_here --project-ref ' + PROJECT_REF + ' (optional)');
  
} catch (error) {
  console.error('\n❌ Deployment failed!');
  console.error('Error:', error.message);
  process.exit(1);
}

