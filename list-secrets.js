/**
 * List Edge Function Secrets
 */

const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';
const PROJECT_REF = 'gwubzauelilziaqnsfac';

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/secrets`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
  },
};

console.log('🔑 Listing Edge Function secrets...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}\n`);

    try {
      const response = JSON.parse(data);

      if (Array.isArray(response)) {
        console.log(`Found ${response.length} secret(s):\n`);
        response.forEach((secret, index) => {
          console.log(`${index + 1}. ${secret.name}`);
          console.log(`   Value: ${secret.value ? '[SET]' : '[NOT SET]'}`);
          console.log('');
        });

        // Check for missing required secrets
        const requiredSecrets = ['OPENAI_API_KEY', 'AGENT_SUPABASE_ACCESS_TOKEN'];
        const setSecrets = response.map(s => s.name);
        const missing = requiredSecrets.filter(name => !setSecrets.includes(name));

        if (missing.length > 0) {
          console.log('\n⚠️  Missing required secrets:');
          missing.forEach(name => {
            console.log(`   - ${name}`);
          });
          console.log('\nSet missing secrets via Dashboard:');
          console.log(`https://supabase.com/dashboard/project/${PROJECT_REF}/settings/functions`);
        } else {
          console.log('\n✅ All required secrets are set!');
        }
      } else {
        console.log('Response:', JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
