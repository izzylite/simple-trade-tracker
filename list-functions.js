/**
 * List Edge Functions
 */

const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';
const PROJECT_REF = 'gwubzauelilziaqnsfac';

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/functions`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
};

console.log('📋 Listing edge functions...\n');

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
        console.log(`Found ${response.length} function(s):\n`);
        response.forEach((fn, index) => {
          console.log(`${index + 1}. ${fn.name || fn.slug}`);
          console.log(`   ID: ${fn.id}`);
          console.log(`   Status: ${fn.status}`);
          console.log(`   Version: ${fn.version}`);
          console.log(`   JWT Verification: ${fn.verify_jwt ? 'Enabled' : 'Disabled'}`);
          console.log(`   Created: ${new Date(fn.created_at).toLocaleString()}`);
          console.log(`   Updated: ${new Date(fn.updated_at).toLocaleString()}`);
          console.log('');
        });
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
