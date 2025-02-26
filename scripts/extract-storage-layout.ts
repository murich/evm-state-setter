import fs from 'fs';
import path from 'path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import type { Artifact } from 'hardhat/types';

// Extend the HardhatRuntimeEnvironment type with storage layout plugin
interface ExtendedHRE extends HardhatRuntimeEnvironment {
  storageLayout?: {
    getStorageLayout?: (contractName: string) => Promise<any>;
    export?: () => Promise<void>;
  };
}

// Extend the Artifact type
interface ExtendedArtifact extends Artifact {
  buildInfo?: string;
  storageLayout?: any;
}

// This script extracts and saves storage layouts from all contracts
async function main() {
  console.log('Extracting storage layouts from contracts...');
  const hre = require('hardhat') as ExtendedHRE;
  
  // Force recompilation
  await hre.run('clean');
  await hre.run('compile');
  
  // Directory to save the storage layouts
  const outputDir = path.join(process.cwd(), 'storage-layouts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log(`Storage layouts will be saved to: ${outputDir}`);
  
  // Get all contracts
  const fullNames = await hre.artifacts.getAllFullyQualifiedNames();
  let extractedCount = 0;
  
  for (const fullName of fullNames) {
    // Skip interfaces and libraries - generally don't have storage
    if (fullName.includes(':Interface') || fullName.endsWith('Interface') || 
        fullName.includes(':Library') || fullName.endsWith('Library')) {
      continue;
    }
    
    try {
      // Split the fully qualified name to get source and contract names
      const [sourceName, contractName] = fullName.split(':');
      
      // Try to get storage layout directly through hardhat API first
      let storageLayout = null;
      
      // Method 1: Try to use the storageLayout plugin API if available
      try {
        if (typeof hre.storageLayout?.getStorageLayout === 'function') {
          storageLayout = await hre.storageLayout.getStorageLayout(fullName);
        }
      } catch (err: any) {
        console.log(`Could not get storage layout via API for ${contractName}: ${err.message}`);
      }
      
      // Method 2: Try to find it in the build info
      if (!storageLayout) {
        const artifact = await hre.artifacts.readArtifact(fullName) as ExtendedArtifact;
        
        // Skip if there's no buildInfo reference
        if (artifact.buildInfo) {
          // Get the build info file path
          const buildInfoPath = path.join(
            hre.config.paths.artifacts,
            'build-info',
            `${artifact.buildInfo}.json`
          );
          
          // Skip if build info doesn't exist
          if (fs.existsSync(buildInfoPath)) {
            const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
            
            // Find the contract in the build info output
            if (
              buildInfo.output?.contracts?.[sourceName]?.[contractName]?.storageLayout
            ) {
              storageLayout = buildInfo.output.contracts[sourceName][contractName].storageLayout;
            }
          }
        }
      }
      
      // Method 3: Look for it in the artifact itself
      if (!storageLayout) {
        const artifactPath = path.join(
          hre.config.paths.artifacts,
          'contracts',
          sourceName.replace(/^contracts\//, ''),
          `${contractName}.json`
        );
        
        if (fs.existsSync(artifactPath)) {
          const artifactJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as ExtendedArtifact;
          if (artifactJson.storageLayout) {
            storageLayout = artifactJson.storageLayout;
          }
        }
      }
      
      // Save the storage layout if found
      if (storageLayout) {
        // Save the storage layout to a file
        const outputFile = path.join(outputDir, `${contractName}.json`);
        fs.writeFileSync(
          outputFile,
          JSON.stringify(storageLayout, null, 2)
        );
        
        console.log(`Extracted storage layout for ${contractName}`);
        extractedCount++;
        
        // Also update the artifact JSON if it exists
        const artifactPath = path.join(
          hre.config.paths.artifacts,
          'contracts',
          sourceName.replace(/^contracts\//, ''),
          `${contractName}.json`
        );
        
        if (fs.existsSync(artifactPath)) {
          const artifactJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8')) as ExtendedArtifact;
          if (!artifactJson.storageLayout) {
            artifactJson.storageLayout = storageLayout;
            fs.writeFileSync(artifactPath, JSON.stringify(artifactJson, null, 2));
            console.log(`Added storageLayout to artifact for ${contractName}`);
          }
        }
      } else {
        console.log(`No storage layout found for ${contractName}`);
      }
    } catch (error: any) {
      console.error(`Error processing ${fullName}:`, error.message);
    }
  }
  
  console.log(`Storage layout extraction complete! Extracted ${extractedCount} layouts.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });