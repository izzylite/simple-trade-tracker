/**
 * Check Edge Function Logs
 */

const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';
const PROJECT_REF = 'gwubzauelilziaqnsfac';

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/functions/ai-trading-agent/logs`,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
  },
};

console.log('📋 Fetching recent logs for ai-trading-agent...\n');

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
        console.log(`Found ${response.length} log entries:\n`);
        response.slice(0, 20).forEach((log, index) => {
          const timestamp = new Date(log.timestamp).toLocaleString();
          console.log(`${index + 1}. [${timestamp}] ${log.level}`);
          console.log(`   ${log.message}`);
          if (log.metadata) {
            console.log(`   Metadata:`, JSON.stringify(log.metadata, null, 2));
          }
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
