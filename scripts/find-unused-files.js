const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../src');
const entryPoints = [
  path.join(rootDir, 'index.tsx'),
  path.join(rootDir, 'react-app-env.d.ts'),
  path.join(rootDir, 'setupTests.ts'), // Potential entry point
  path.join(rootDir, 'setupTests.js'), // Potential entry point
];

// Extensions to look for when resolving imports
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function resolveImport(sourceFile, importPath) {
  if (importPath.startsWith('.')) {
    const dir = path.dirname(sourceFile);
    const absolutePath = path.resolve(dir, importPath);
    
    // Check exact match
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      return absolutePath;
    }
    
    // Check with extensions
    for (const ext of extensions) {
      if (fs.existsSync(absolutePath + ext)) {
        return absolutePath + ext;
      }
    }
    
    // Check directory index
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory()) {
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const indexPath = path.join(absolutePath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }
  }
  return null; // Node modules or aliases (not handled/needed for this check)
}

function getImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports = [];
  
  // Regex for imports
  const importRegex = /import\s+(?:[\s\S]*?from\s+)?['"](.*?)['"]/g;
  const dynamicImportRegex = /import\(['"](.*?)['"]\)/g;
  const requireRegex = /require\(['"](.*?)['"]\)/g;
  const sideEffectImportRegex = /import\s+['"](.*?)['"]/g;
  const exportFromRegex = /export\s+(?:[\s\S]*?from\s+)?['"](.*?)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = sideEffectImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
  }
  while ((match = exportFromRegex.exec(content)) !== null) {
      imports.push(match[1]);
  }

  return imports;
}

const allFiles = getAllFiles(rootDir);
const visited = new Set();
const queue = [];

// Initialize queue with existing entry points
entryPoints.forEach(ep => {
  if (fs.existsSync(ep)) {
    queue.push(ep);
    visited.add(ep);
  }
});

// Also add any file in src/scripts/ as entry points if they exist (though usually scripts are outside src)
// But wait, the user has a scripts folder in root, not src/scripts usually.
// Let's check if there are any other obvious entry points.
// Maybe src/main.tsx?
const mainTsx = path.join(rootDir, 'main.tsx');
if (fs.existsSync(mainTsx) && !visited.has(mainTsx)) {
    queue.push(mainTsx);
    visited.add(mainTsx);
}


while (queue.length > 0) {
  const currentFile = queue.shift();
  const ext = path.extname(currentFile);
  
  // Only parse code files
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    try {
      const imports = getImports(currentFile);
      imports.forEach(imp => {
        const resolved = resolveImport(currentFile, imp);
        if (resolved && !visited.has(resolved)) {
          visited.add(resolved);
          queue.push(resolved);
        }
      });
    } catch (e) {
      console.error(`Error parsing ${currentFile}:`, e);
    }
  }
}

const unusedFiles = allFiles.filter(f => !visited.has(f));

console.log('--- Unused Files ---');
unusedFiles.forEach(f => {
  console.log(path.relative(rootDir, f));
});
