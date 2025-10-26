/**
 * Deploy with Deno Bundle
 *
 * This script bundles the function locally with Deno, then deploys the bundle
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';
const PROJECT_REF = 'gwubzauelilziaqnsfac';
const FUNCTION_NAME = 'ai-trading-agent';

console.log('📦 Step 1: Bundling function with Deno...\n');

const functionDir = path.join(__dirname, 'supabase', 'functions', FUNCTION_NAME);
const bundlePath = path.join(__dirname, 'ai-trading-agent-bundle.js');

try {
  // Bundle with Deno
  const bundleCommand = `deno bundle --config="${path.join(functionDir, 'deno.json')}" "${path.join(functionDir, 'index.ts')}" "${bundlePath}"`;

  console.log('Running:', bundleCommand);
  execSync(bundleCommand, { stdio: 'inherit' });

  console.log('\n✅ Bundle created successfully\n');

  // Read the bundle
  const bundleCode = fs.readFileSync(bundlePath, 'utf8');
  console.log(`📄 Bundle size: ${(bundleCode.length / 1024).toFixed(2)} KB\n`);

  console.log('🗑️  Deleting old function version...\n');

  // Delete old version
  const deleteOptions = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${PROJECT_REF}/functions/${FUNCTION_NAME}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    },
  };

  const deleteReq = https.request(deleteOptions, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      console.log(`Delete status: ${res.statusCode}\n`);

      // Wait then deploy
      setTimeout(() => deployBundle(bundleCode), 1000);
    });
  });

  deleteReq.on('error', () => {
    // Ignore errors, proceed to deploy
    setTimeout(() => deployBundle(bundleCode), 1000);
  });

  deleteReq.end();

} catch (error) {
  console.error('❌ Bundle failed:', error.message);
  console.error('\n💡 Make sure Deno is installed:');
  console.error('   https://deno.land/manual/getting_started/installation');
  process.exit(1);
}

function deployBundle(bundleCode) {
  console.log('🚀 Deploying bundled function...\n');

  const payload = {
    slug: FUNCTION_NAME,
    name: FUNCTION_NAME,
    verify_jwt: true,
    body: bundleCode,
    // No import map needed - everything is bundled
  };

  const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${PROJECT_REF}/functions`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Deploy status: ${res.statusCode}\n`);

      try {
        const response = JSON.parse(data);

        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Deployment successful!\n');
          console.log('Function Details:');
          console.log(`   ID: ${response.id}`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Version: ${response.version}`);
          console.log('\n🎉 Function is now live!');
          console.log('\nTest it from your React app.');

          // Clean up bundle file
          fs.unlinkSync(bundlePath);
          console.log('\n🧹 Cleaned up temporary bundle file');
        } else {
          console.log('❌ Deployment failed!');
          console.log(JSON.stringify(response, null, 2));
        }
      } catch (error) {
        console.log('❌ Error parsing response:');
        console.log(data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.write(JSON.stringify(payload));
  req.end();
}
