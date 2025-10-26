/**
 * Set Secrets for AI Trading Agent
 *
 * This script sets environment secrets for the edge function
 * using the Supabase Management API.
 *
 * Usage: node set-secrets.js
 */

const https = require('https');
const readline = require('readline');

// Configuration
const SUPABASE_ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';
const PROJECT_REF = 'gwubzauelilziaqnsfac';

// Secrets to set
const secrets = [
  {
    name: 'AGENT_SUPABASE_ACCESS_TOKEN',
    value: 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9',
    required: true,
    description: 'Personal Access Token for MCP access',
  },
];

// Optional secrets - will prompt for these
const optionalSecrets = [
  {
    name: 'OPENAI_API_KEY',
    description: 'OpenAI API key for AI agent',
    example: 'sk-proj-...',
  },
  {
    name: 'SERPER_API_KEY',
    description: 'Serper API key for web search (optional)',
    example: 'your_serper_key',
  },
];

async function setSecret(name, value) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify([
      {
        name: name,
        value: value,
      },
    ]);

    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/secrets`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          console.log(`   ✅ ${name} set successfully`);
          resolve();
        } else {
          console.log(`   ❌ ${name} failed (Status: ${res.statusCode})`);
          console.log(`   Response: ${data}`);
          reject(new Error(`Failed to set ${name}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`   ❌ Error setting ${name}:`, error.message);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

async function promptForSecret(secret) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `\n${secret.description}\nEnter ${secret.name} (or press Enter to skip): `,
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}

async function main() {
  console.log('🔐 Setting up secrets for AI Trading Agent\n');
  console.log('═'.repeat(60));

  // Set required secrets
  console.log('\n📝 Setting required secrets...\n');

  for (const secret of secrets) {
    try {
      await setSecret(secret.name, secret.value);
    } catch (error) {
      console.error(`Failed to set ${secret.name}. Continuing...`);
    }
  }

  // Prompt for optional secrets
  console.log('\n📝 Optional secrets...\n');
  console.log('You can set these now or later via Supabase Dashboard:');
  console.log('https://supabase.com/dashboard/project/gwubzauelilziaqnsfac/settings/functions\n');

  for (const secret of optionalSecrets) {
    const value = await promptForSecret(secret);
    if (value) {
      try {
        await setSecret(secret.name, value);
      } catch (error) {
        console.error(`Failed to set ${secret.name}. You can set it later.`);
      }
    } else {
      console.log(`   ⏭️  Skipped ${secret.name}`);
    }
  }

  console.log('\n═'.repeat(60));
  console.log('\n✅ Secret setup complete!\n');
  console.log('📋 Next Steps:\n');
  console.log('1. If you skipped OPENAI_API_KEY, set it via Dashboard or CLI');
  console.log('2. Test the function with a simple query');
  console.log('3. Check function logs in Supabase Dashboard:\n');
  console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/logs/edge-functions`);
  console.log('\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
