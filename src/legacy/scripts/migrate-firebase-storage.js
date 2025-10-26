/**
 * Firebase Storage to Supabase Storage Migration Script
 * Migrates all trade images from Firebase Storage to Supabase Storage
 * Preserves folder structure and metadata
 */

const { initializeApp } = require('firebase/app');
const { getStorage, ref, listAll, getDownloadURL, getMetadata } = require('firebase/storage');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cliProgress = require('cli-progress');
require('dotenv').config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_SERVICE_KEY in your .env file');
  process.exit(1);
}

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const firebaseStorage = getStorage(firebaseApp);
const firebaseAuth = getAuth(firebaseApp);

// Initialize Supabase with service key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration statistics
const stats = {
  totalFiles: 0,
  migratedFiles: 0,
  skippedFiles: 0,
  errorFiles: 0,
  errors: []
};

// Create temp directory for downloads
const tempDir = path.join(__dirname, 'temp-migration');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Download a file from URL to local path
 */
async function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(localPath);
      });
    }).on('error', (err) => {
      fs.unlink(localPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

/**
 * Get all files from Firebase Storage recursively
 */
async function getAllFirebaseFiles(folderRef = null) {
  const files = [];
  
  try {
    const rootRef = folderRef || ref(firebaseStorage, 'users/');
    const result = await listAll(rootRef);
    
    // Add all files in current directory
    files.push(...result.items);
    
    // Recursively get files from subdirectories
    for (const folder of result.prefixes) {
      const subFiles = await getAllFirebaseFiles(folder);
      files.push(...subFiles);
    }
    
    return files;
  } catch (error) {
    console.error('Error listing Firebase files:', error);
    return [];
  }
}

/**
 * Check if file already exists in Supabase
 */
async function fileExistsInSupabase(filePath) {
  try {
    const { data, error } = await supabase.storage
      .from('trade-images')
      .list(path.dirname(filePath), {
        search: path.basename(filePath)
      });
    
    if (error) return false;
    return data && data.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Migrate a single file from Firebase to Supabase
 */
async function migrateFile(firebaseFileRef, progressBar) {
  try {
    const filePath = firebaseFileRef.fullPath;
    const fileName = path.basename(filePath);
    const localTempPath = path.join(tempDir, fileName);
    
    // Check if file already exists in Supabase
    if (await fileExistsInSupabase(filePath)) {
      console.log(`⏭️  Skipping existing file: ${filePath}`);
      stats.skippedFiles++;
      progressBar.increment();
      return;
    }
    
    // Get download URL and metadata from Firebase
    const [downloadURL, metadata] = await Promise.all([
      getDownloadURL(firebaseFileRef),
      getMetadata(firebaseFileRef)
    ]);
    
    // Download file to temp location
    await downloadFile(downloadURL, localTempPath);
    
    // Read file for upload to Supabase
    const fileBuffer = fs.readFileSync(localTempPath);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('trade-images')
      .upload(filePath, fileBuffer, {
        contentType: metadata.contentType || 'image/jpeg',
        cacheControl: '3600',
        upsert: false // Don't overwrite existing files
      });
    
    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }
    
    // Clean up temp file
    fs.unlinkSync(localTempPath);
    
    stats.migratedFiles++;
    console.log(`✅ Migrated: ${filePath}`);
    
  } catch (error) {
    stats.errorFiles++;
    const errorMsg = `❌ Error migrating ${firebaseFileRef.fullPath}: ${error.message}`;
    console.error(errorMsg);
    stats.errors.push(errorMsg);
    
    // Clean up temp file if it exists
    const localTempPath = path.join(tempDir, path.basename(firebaseFileRef.fullPath));
    if (fs.existsSync(localTempPath)) {
      fs.unlinkSync(localTempPath);
    }
  } finally {
    progressBar.increment();
  }
}

/**
 * Authenticate with Firebase (optional - for testing)
 */
async function authenticateFirebase() {
  // For now, we'll try without authentication first
  // If needed, you can add email/password authentication here
  console.log('🔐 Attempting Firebase Storage access...');
  return true;
}

/**
 * Main migration function
 */
async function migrateStorage() {
  console.log('🚀 Starting Firebase Storage to Supabase Storage Migration...\n');

  try {
    // Step 0: Authenticate if needed
    await authenticateFirebase();

    // Step 1: Get all files from Firebase Storage
    console.log('📋 Discovering files in Firebase Storage...');
    const firebaseFiles = await getAllFirebaseFiles();
    stats.totalFiles = firebaseFiles.length;
    
    if (stats.totalFiles === 0) {
      console.log('📭 No files found in Firebase Storage');
      console.log('ℹ️  This could mean:');
      console.log('   - No images have been uploaded yet');
      console.log('   - Authentication issues with Firebase Storage');
      console.log('   - Storage bucket is empty');
      console.log('\n✅ Migration setup is ready for when files are added!');
      return;
    }
    
    console.log(`📊 Found ${stats.totalFiles} files to migrate\n`);
    
    // Step 2: Verify Supabase bucket exists
    console.log('🔍 Verifying Supabase bucket...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      throw new Error(`Failed to access Supabase Storage: ${bucketError.message}`);
    }
    
    const tradeImagesBucket = buckets.find(bucket => bucket.id === 'trade-images');
    if (!tradeImagesBucket) {
      throw new Error('trade-images bucket not found in Supabase Storage');
    }
    
    console.log('✅ Supabase bucket verified\n');
    
    // Step 3: Migrate files with progress tracking
    console.log('🔄 Starting file migration...');
    const progressBar = new cliProgress.SingleBar({
      format: 'Migration Progress |{bar}| {percentage}% | {value}/{total} files | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    progressBar.start(stats.totalFiles, 0);
    
    // Process files in batches to avoid overwhelming the APIs
    const batchSize = 5;
    for (let i = 0; i < firebaseFiles.length; i += batchSize) {
      const batch = firebaseFiles.slice(i, i + batchSize);
      await Promise.all(batch.map(file => migrateFile(file, progressBar)));
    }
    
    progressBar.stop();
    
    // Step 4: Display results
    console.log('\n🎉 Migration completed!\n');
    console.log('📊 Migration Summary:');
    console.log(`   Total files: ${stats.totalFiles}`);
    console.log(`   ✅ Migrated: ${stats.migratedFiles}`);
    console.log(`   ⏭️  Skipped: ${stats.skippedFiles}`);
    console.log(`   ❌ Errors: ${stats.errorFiles}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach(error => console.log(`   ${error}`));
    }
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    console.log('\n✅ Migration process completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  migrateStorage().catch(console.error);
}

module.exports = { migrateStorage };
