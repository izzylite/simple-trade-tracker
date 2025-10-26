/**
 * Setup Supabase Storage Buckets and Policies
 * This script creates the trade-images bucket and sets up RLS policies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_SERVICE_KEY in your .env file');
  process.exit(1);
}

// Create Supabase client with service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('🚀 Setting up Supabase Storage for Trade Images...\n');

  try {
    // Step 1: Create the storage bucket
    console.log('📦 Creating trade-images bucket...');
    
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('trade-images', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    });

    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Bucket already exists, skipping creation');
      } else {
        throw bucketError;
      }
    } else {
      console.log('✅ Bucket created successfully');
    }

    // Step 2: Set up RLS policies
    console.log('\n🔒 Setting up RLS policies...');

    const policies = [
      {
        name: 'Users can upload to their own folder',
        sql: `
          CREATE POLICY "Users can upload to their own folder"
          ON storage.objects
          FOR INSERT
          TO authenticated
          WITH CHECK (
              bucket_id = 'trade-images'
              AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
          );
        `
      },
      {
        name: 'Users can download their own files',
        sql: `
          CREATE POLICY "Users can download their own files"
          ON storage.objects
          FOR SELECT
          TO authenticated
          USING (
              bucket_id = 'trade-images'
              AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
          );
        `
      },
      {
        name: 'Users can update their own files',
        sql: `
          CREATE POLICY "Users can update their own files"
          ON storage.objects
          FOR UPDATE
          TO authenticated
          USING (
              bucket_id = 'trade-images'
              AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
          );
        `
      },
      {
        name: 'Users can delete their own files',
        sql: `
          CREATE POLICY "Users can delete their own files"
          ON storage.objects
          FOR DELETE
          TO authenticated
          USING (
              bucket_id = 'trade-images'
              AND (storage.objects.name LIKE 'users/' || auth.uid()::text || '/trade-images/%')
          );
        `
      }
    ];

    // Apply each policy
    for (const policy of policies) {
      console.log(`📝 Creating policy: ${policy.name}`);
      
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: policy.sql
      });

      if (policyError) {
        if (policyError.message.includes('already exists')) {
          console.log(`✅ Policy already exists, skipping: ${policy.name}`);
        } else {
          console.error(`❌ Error creating policy "${policy.name}":`, policyError);
        }
      } else {
        console.log(`✅ Policy created: ${policy.name}`);
      }
    }

    // Step 3: Create helper functions
    console.log('\n🔧 Creating helper functions...');
    
    const helperFunctions = [
      {
        name: 'get_trade_image_path',
        sql: `
          CREATE OR REPLACE FUNCTION get_trade_image_path(user_id UUID, filename TEXT)
          RETURNS TEXT
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
              IF auth.uid()::text != (SELECT firebase_uid FROM users WHERE id = user_id) THEN
                  RAISE EXCEPTION 'Access denied: Cannot generate path for other users';
              END IF;
              
              RETURN 'users/' || auth.uid()::text || '/trade-images/' || filename;
          END;
          $$;
        `
      },
      {
        name: 'validate_user_storage_path',
        sql: `
          CREATE OR REPLACE FUNCTION validate_user_storage_path(storage_path TEXT)
          RETURNS BOOLEAN
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
              RETURN storage_path LIKE 'users/' || auth.uid()::text || '/trade-images/%';
          END;
          $$;
        `
      }
    ];

    for (const func of helperFunctions) {
      console.log(`🔧 Creating function: ${func.name}`);
      
      const { error: funcError } = await supabase.rpc('exec_sql', {
        sql: func.sql
      });

      if (funcError) {
        console.error(`❌ Error creating function "${func.name}":`, funcError);
      } else {
        console.log(`✅ Function created: ${func.name}`);
      }
    }

    console.log('\n🎉 Storage setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Bucket: trade-images (private)');
    console.log('- File size limit: 50MB');
    console.log('- Allowed types: JPEG, PNG, GIF, WebP');
    console.log('- Folder structure: users/{userId}/trade-images/');
    console.log('- RLS policies: ✅ Configured');
    console.log('- Helper functions: ✅ Created');

  } catch (error) {
    console.error('❌ Error setting up storage:', error);
    process.exit(1);
  }
}

// Run the setup
setupStorage();
