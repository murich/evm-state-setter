import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-storage-layout";
import fs from "fs";
import path from "path";

// Import our plugin
import "./dist/index";

// Add a task to print storage layouts
task("storage-layout", "Prints the storage layout of contracts")
  .setAction(async (_, { run, artifacts, config }) => {
    await run("compile");
    
    // Create a directory to save storage layouts
    const outputDir = path.join(process.cwd(), 'storage-layouts');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get all contract names
    const fullNames = await artifacts.getAllFullyQualifiedNames();
    let extractedCount = 0;
    
    for (const fullName of fullNames) {
      try {
        // Skip interfaces and libraries
        if (fullName.includes(':Interface') || fullName.endsWith('Interface') || 
            fullName.includes(':Library') || fullName.endsWith('Library')) {
          continue;
        }
        
        const [sourceName, contractName] = fullName.split(':');
        const buildInfoFiles = fs.readdirSync(path.join(config.paths.artifacts, "build-info"));
        
        for (const buildInfoFile of buildInfoFiles) {
          const buildInfoPath = path.join(config.paths.artifacts, "build-info", buildInfoFile);
          const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
          
          // Get the storage layout
          const storageLayout = buildInfo.output?.contracts?.[sourceName]?.[contractName]?.storageLayout;
          
          if (storageLayout) {
            // Save to file
            const outputFile = path.join(outputDir, `${contractName}.json`);
            fs.writeFileSync(outputFile, JSON.stringify(storageLayout, null, 2));
            
            console.log(`Extracted storage layout for ${contractName}`);
            extractedCount++;
            
            // Update the artifact if needed
            const artifactPath = path.join(
              config.paths.artifacts,
              'contracts',
              sourceName.replace(/^contracts\//, ''),
              `${contractName}.json`
            );
            
            if (fs.existsSync(artifactPath)) {
              const artifactJson = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
              if (!artifactJson.storageLayout) {
                artifactJson.storageLayout = storageLayout;
                fs.writeFileSync(artifactPath, JSON.stringify(artifactJson, null, 2));
                console.log(`Added storageLayout to artifact for ${contractName}`);
              }
            }
            
            // Only process the first found storage layout
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing ${fullName}:`, error);
      }
    }
    
    console.log(`Storage layout extraction complete! Extracted ${extractedCount} layouts.`);
  });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["storageLayout"],
        },
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  // Add state setter config
  stateSetterConfig: {
    artifactsPath: "./artifacts",
    storageLayoutsPath: "./storage-layouts"
  }
};

export default config;
