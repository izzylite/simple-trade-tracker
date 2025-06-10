#!/bin/bash

# Update system packages
sudo apt-get update

# Install Node.js 18 (required for Firebase Functions)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js and npm installation
node --version
npm --version

# Navigate to workspace
cd /mnt/persist/workspace

# Install main project dependencies
echo "Installing main project dependencies..."
npm install

# Install Firebase Functions dependencies
echo "Installing Firebase Functions dependencies..."
cd functions
npm install
cd ..

# Install Firebase CLI globally
npm install -g firebase-tools

# Build the project to ensure everything is working
echo "Building the project..."
npm run build

# Build Firebase Functions
echo "Building Firebase Functions..."
cd functions
npm run build
cd ..

# Add Node.js and npm to PATH in user profile
echo 'export PATH="/usr/bin:$PATH"' >> $HOME/.profile

echo "Setup completed successfully!"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Firebase CLI version: $(firebase --version)"