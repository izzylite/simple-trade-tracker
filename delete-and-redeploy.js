/**
 * Delete and Redeploy AI Trading Agent
 *
 * This script deletes the existing function and redeploys it with updates.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_ACCESS_TOKEN = 'sbp_1ed5c00c6cb53393f5688584281c554019de57b9';
const PROJECT_REF = 'gwubzauelilziaqnsfac';
const FUNCTION_NAME = 'ai-trading-agent';
const FUNCTION_ID = '8d280cc6-70e7-484d-b633-de5bb17b3561';

console.log('🗑️  Deleting existing function...\n');

// Step 1: Delete existing function
const deleteOptions = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/functions/${FUNCTION_ID}`,
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
  },
};

const deleteReq = https.request(deleteOptions, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Delete Status: ${res.statusCode}`);

    if (res.statusCode === 200 || res.statusCode === 204) {
      console.log('✅ Function deleted successfully\n');

      // Wait a moment before redeploying
      setTimeout(() => {
        console.log('📦 Reading function files for redeployment...\n');

        // Step 2: Redeploy
        const functionDir = path.join(__dirname, 'supabase', 'functions', FUNCTION_NAME);

        const files = {
          'index.ts': fs.readFileSync(path.join(functionDir, 'index.ts'), 'utf8'),
          'serper-tool.ts': fs.readFileSync(path.join(functionDir, 'serper-tool.ts'), 'utf8'),
          'formatters.ts': fs.readFileSync(path.join(functionDir, 'formatters.ts'), 'utf8'),
          'types.ts': fs.readFileSync(path.join(functionDir, 'types.ts'), 'utf8'),
        };

        const importMap = JSON.parse(
          fs.readFileSync(path.join(functionDir, 'deno.json'), 'utf8')
        );

        const payload = {
          slug: FUNCTION_NAME,
          name: FUNCTION_NAME,
          verify_jwt: true,
          import_map: JSON.stringify(importMap.imports),
          entrypoint_path: 'index.ts',
          body: files['index.ts'],
          imports: Object.entries(files)
            .filter(([name]) => name !== 'index.ts')
            .map(([name, content]) => ({
              name: name,
              content: content,
            })),
        };

        console.log('🚀 Redeploying function...\n');

        const deployOptions = {
          hostname: 'api.supabase.com',
          port: 443,
          path: `/v1/projects/${PROJECT_REF}/functions`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        };

        const deployReq = https.request(deployOptions, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            console.log(`Deploy Status: ${res.statusCode}\n`);

            try {
              const response = JSON.parse(data);

              if (res.statusCode === 200 || res.statusCode === 201) {
                console.log('✅ Redeployment successful!\n');
                console.log('Function Details:');
                console.log(`   ID: ${response.id}`);
                console.log(`   Status: ${response.status}`);
                console.log(`   Version: ${response.version}`);
                console.log(`   JWT Verification: ${response.verify_jwt ? 'Enabled' : 'Disabled'}`);
                console.log('\n🎉 CORS fix has been applied!');
                console.log('\nYou can now test the function from your React app.');
              } else {
                console.log('❌ Redeployment failed!');
                console.log(JSON.stringify(response, null, 2));
              }
            } catch (error) {
              console.log('❌ Error parsing response:');
              console.log(data);
            }
          });
        });

        deployReq.on('error', (error) => {
          console.error('❌ Deploy error:', error.message);
        });

        deployReq.write(JSON.stringify(payload));
        deployReq.end();
      }, 2000); // Wait 2 seconds before redeploying
    } else {
      console.log('❌ Delete failed!');
      console.log(data);
    }
  });
});

deleteReq.on('error', (error) => {
  console.error('❌ Delete error:', error.message);
});

deleteReq.end();
