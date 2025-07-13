/**
 * Setup Firestore Vector Index for Trade Embeddings
 * This script helps set up the required vector index for the AI chat optimization
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  collectionGroup: 'trade-embeddings',
  vectorField: 'embedding',
  dimension: 768, // Text embedding dimension for Firebase AI Logic
  database: '(default)'
};

function checkGCloudInstalled() {
  try {
    execSync('gcloud --version', { stdio: 'pipe' });
    console.log('✅ Google Cloud CLI is installed');
    return true;
  } catch (error) {
    console.error('❌ Google Cloud CLI is not installed or not in PATH');
    console.log('Please install it from: https://cloud.google.com/sdk/docs/install');
    return false;
  }
}

function checkGCloudAuth() {
  try {
    const result = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (result.trim()) {
      console.log('✅ Google Cloud CLI is authenticated');
      console.log(`   Active account: ${result.trim()}`);
      return true;
    } else {
      console.error('❌ Google Cloud CLI is not authenticated');
      console.log('Please run: gcloud auth login');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking authentication:', error.message);
    return false;
  }
}

function getFirebaseProject() {
  try {
    // Try to read from .firebaserc
    const firebaseRcPath = path.join(process.cwd(), '.firebaserc');
    if (fs.existsSync(firebaseRcPath)) {
      const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
      const projectId = firebaseRc.projects?.default;
      if (projectId) {
        console.log(`✅ Found Firebase project: ${projectId}`);
        return projectId;
      }
    }

    // Try to get from gcloud config
    const result = execSync('gcloud config get-value project', { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const projectId = result.trim();
    if (projectId && projectId !== '(unset)') {
      console.log(`✅ Using gcloud project: ${projectId}`);
      return projectId;
    }

    throw new Error('No project found');
  } catch (error) {
    console.error('❌ Could not determine Firebase project ID');
    console.log('Please ensure you have a .firebaserc file or set gcloud project:');
    console.log('   gcloud config set project YOUR_PROJECT_ID');
    return null;
  }
}

function createVectorIndex(projectId) {
  console.log('\n🔧 Creating Firestore vector index...');
  
  const command = `gcloud firestore indexes composite create \\
    --project=${projectId} \\
    --collection-group=${CONFIG.collectionGroup} \\
    --query-scope=COLLECTION \\
    --field-config=field-path=calendarId,order=ASCENDING \\
    --field-config=field-path=${CONFIG.vectorField},vector-config='{"dimension":"${CONFIG.dimension}", "flat": "{}"}' \\
    --database=${CONFIG.database}`;

  console.log('Running command:');
  console.log(command.replace(/\\/g, ''));
  
  try {
    const result = execSync(command.replace(/\\/g, ''), { 
      encoding: 'utf8',
      stdio: 'inherit'
    });
    
    console.log('\n✅ Vector index creation initiated successfully!');
    console.log('📝 Note: Index creation may take several minutes to complete.');
    console.log('   You can check the status in the Firebase Console under Firestore > Indexes');
    
    return true;
  } catch (error) {
    console.error('\n❌ Failed to create vector index:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('💡 The index might already exist. Check the Firebase Console.');
    } else if (error.message.includes('permission')) {
      console.log('💡 Make sure you have the necessary permissions for this project.');
    }
    
    return false;
  }
}

function listExistingIndexes(projectId) {
  console.log('\n📋 Checking existing indexes...');
  
  try {
    const result = execSync(`gcloud firestore indexes composite list --project=${projectId} --database=${CONFIG.database}`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    if (result.includes(CONFIG.collectionGroup) && result.includes(CONFIG.vectorField)) {
      console.log('✅ Vector index for trade-embeddings already exists!');
      return true;
    } else {
      console.log('ℹ️  No existing vector index found for trade-embeddings');
      return false;
    }
  } catch (error) {
    console.log('⚠️  Could not check existing indexes:', error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Setting up Firestore Vector Index for AI Chat Optimization\n');
  
  // Check prerequisites
  if (!checkGCloudInstalled()) {
    process.exit(1);
  }
  
  if (!checkGCloudAuth()) {
    process.exit(1);
  }
  
  const projectId = getFirebaseProject();
  if (!projectId) {
    process.exit(1);
  }
  
  // Check if index already exists
  if (listExistingIndexes(projectId)) {
    console.log('\n🎉 Setup complete! Vector index is ready to use.');
    process.exit(0);
  }
  
  // Create the index
  if (createVectorIndex(projectId)) {
    console.log('\n🎉 Setup initiated successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Wait for index creation to complete (check Firebase Console)');
    console.log('2. Test the AI chat with vector search enabled');
    console.log('3. Monitor token usage reduction in browser dev tools');
  } else {
    console.log('\n❌ Setup failed. Please check the error messages above.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkGCloudInstalled,
  checkGCloudAuth,
  getFirebaseProject,
  createVectorIndex,
  listExistingIndexes
};
