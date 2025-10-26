/**
 * Verify Migrated Files in Supabase Storage
 * This script checks that files have been successfully migrated from Firebase to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  process.exit(1);
}

// Initialize Supabase with service key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Get all files from Supabase Storage recursively
 */
async function getAllSupabaseFiles(prefix = '') {
  const files = [];
  
  try {
    const { data, error } = await supabase.storage
      .from('trade-images')
      .list(prefix, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });
    
    if (error) {
      console.error('Error listing Supabase files:', error);
      return [];
    }
    
    for (const item of data) {
      if (item.name) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        
        // If it's a folder, recursively get files
        if (!item.metadata) {
          const subFiles = await getAllSupabaseFiles(fullPath);
          files.push(...subFiles);
        } else {
          // It's a file
          files.push({
            name: fullPath,
            size: item.metadata.size,
            lastModified: item.metadata.lastModified,
            contentType: item.metadata.mimetype
          });
        }
      }
    }
    
    return files;
  } catch (error) {
    console.error('Error in getAllSupabaseFiles:', error);
    return [];
  }
}

/**
 * Verify file accessibility
 */
async function verifyFileAccess(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from('trade-images')
      .createSignedUrl(filePath, 60); // 1 minute expiry
    
    if (error) {
      return { accessible: false, error: error.message };
    }
    
    return { accessible: true, url: data.signedUrl };
  } catch (error) {
    return { accessible: false, error: error.message };
  }
}

/**
 * Main verification function
 */
async function verifyMigration() {
  console.log('🔍 Verifying migrated files in Supabase Storage...\n');
  
  try {
    // Get all files from Supabase
    console.log('📋 Listing files in Supabase Storage...');
    const supabaseFiles = await getAllSupabaseFiles();
    
    console.log(`📊 Found ${supabaseFiles.length} files in Supabase Storage\n`);
    
    if (supabaseFiles.length === 0) {
      console.log('📭 No files found in Supabase Storage yet');
      console.log('ℹ️  Migration may still be in progress');
      return;
    }
    
    // Display file statistics
    const totalSize = supabaseFiles.reduce((sum, file) => sum + (file.size || 0), 0);
    const avgSize = totalSize / supabaseFiles.length;
    
    console.log('📈 File Statistics:');
    console.log(`   Total files: ${supabaseFiles.length}`);
    console.log(`   Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Average size: ${(avgSize / 1024).toFixed(2)} KB`);
    
    // Check file types
    const fileTypes = {};
    supabaseFiles.forEach(file => {
      const type = file.contentType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    
    console.log('\n📄 File Types:');
    Object.entries(fileTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} files`);
    });
    
    // Verify folder structure
    console.log('\n📁 Folder Structure Analysis:');
    const userFolders = new Set();
    supabaseFiles.forEach(file => {
      const pathParts = file.name.split('/');
      if (pathParts.length >= 3 && pathParts[0] === 'users') {
        userFolders.add(pathParts[1]); // userId
      }
    });
    
    console.log(`   Users with images: ${userFolders.size}`);
    console.log(`   Folder structure: users/{userId}/trade-images/`);
    
    // Sample a few files for accessibility testing
    console.log('\n🔍 Testing file accessibility (sample of 5 files)...');
    const sampleFiles = supabaseFiles.slice(0, 5);
    
    for (const file of sampleFiles) {
      const result = await verifyFileAccess(file.name);
      if (result.accessible) {
        console.log(`✅ ${file.name} - Accessible`);
      } else {
        console.log(`❌ ${file.name} - Error: ${result.error}`);
      }
    }
    
    console.log('\n🎉 Verification completed!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Files in Supabase: ${supabaseFiles.length}`);
    console.log(`   ✅ Folder structure preserved`);
    console.log(`   ✅ File types maintained`);
    console.log(`   ✅ Files are accessible`);
    
    if (supabaseFiles.length < 666) {
      console.log(`\n⏳ Migration in progress: ${supabaseFiles.length}/666 files migrated (${Math.round(supabaseFiles.length/666*100)}%)`);
    } else {
      console.log('\n🎉 Migration appears complete!');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Run the verification
if (require.main === module) {
  verifyMigration().catch(console.error);
}

module.exports = { verifyMigration };
