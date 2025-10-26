#!/usr/bin/env node

/**
 * Test script for AI Trading Agent Edge Function
 * Tests the economic sentiment query to debug the "Unable to generate response" error
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env file');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Invalid Supabase URL format');
  process.exit(1);
}

console.log('🧪 AI Trading Agent Test Script\n');
console.log('📋 Configuration:');
console.log(`   Project: ${projectRef}`);
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);
console.log('');

/**
 * Fetch user data from Supabase to get real user ID and calendar ID
 */
async function getUserData() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: projectRef + '.supabase.co',
      port: 443,
      path: '/rest/v1/users?limit=1',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const users = JSON.parse(data);
          if (users && users.length > 0) {
            resolve(users[0]);
          } else {
            reject(new Error('No users found in database'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch calendar data for a user
 */
async function getCalendarData(userId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: projectRef + '.supabase.co',
      port: 443,
      path: `/rest/v1/calendars?user_id=eq.${userId}&limit=1`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const calendars = JSON.parse(data);
          if (calendars && calendars.length > 0) {
            resolve(calendars[0]);
          } else {
            reject(new Error('No calendars found for user'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Call the AI Trading Agent edge function
 */
async function callAIAgent(userId, calendarId, message) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      message,
      userId,
      calendarId,
      conversationHistory: []
    });

    const options = {
      hostname: projectRef + '.supabase.co',
      port: 443,
      path: '/functions/v1/ai-trading-agent',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    console.log('📤 Sending request to AI agent...');
    console.log(`   Message: "${message}"`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Calendar ID: ${calendarId}\n`);

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📥 Response Status: ${res.statusCode}`);
      console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}\n`);

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}\nRaw: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Main test function
 */
async function main() {
  try {
    let userId, calendarId;

    try {
      console.log('🔍 Fetching user data...');
      const user = await getUserData();
      console.log(`✅ Found user: ${user.email} (ID: ${user.id})\n`);
      userId = user.id;

      console.log('🔍 Fetching calendar data...');
      const calendar = await getCalendarData(user.id);
      console.log(`✅ Found calendar: ${calendar.name} (ID: ${calendar.id})\n`);
      calendarId = calendar.id;
    } catch (e) {
      console.log('⚠️  No real data found, using test IDs\n');
      userId = 'test-user-' + Math.random().toString(36).substring(7);
      calendarId = 'test-calendar-' + Math.random().toString(36).substring(7);
      console.log(`   Using test User ID: ${userId}`);
      console.log(`   Using test Calendar ID: ${calendarId}\n`);
    }

    // Test the economic sentiment query
    const testMessage = 'What\'s the economic sentiment for EURUSD this coming week?';

    console.log('🚀 Testing AI Agent with economic sentiment query...\n');
    const response = await callAIAgent(userId, calendarId, testMessage);

    console.log('📊 Response:');
    console.log(JSON.stringify(response, null, 2));

    if (response.success) {
      console.log('\n✅ SUCCESS! AI agent responded correctly');
      console.log(`   Message: ${response.message}`);
      if (response.metadata?.functionCalls) {
        console.log(`   Function calls: ${response.metadata.functionCalls.length}`);
        response.metadata.functionCalls.forEach((call, i) => {
          console.log(`     ${i + 1}. ${call.name}`);
          console.log(`        Args: ${JSON.stringify(call.args)}`);
          console.log(`        Result: ${call.result.substring(0, 100)}...`);
        });
      }
    } else {
      console.log('\n❌ FAILED! AI agent returned error');
      console.log(`   Error: ${response.error || response.message}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    process.exit(1);
  }
}

main();

