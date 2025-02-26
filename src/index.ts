import { extendConfig, extendEnvironment, task } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";
import path from "path";
import fs from "fs";

import { StateSetterOptions, StorageLocation, VarLocation, SetStateParams } from './types';
import { getStorageLocation, loadStorageLayout, findVariableLocation } from './storage-layout';
import { setSlotValue } from './slot-utils';

// Define setState function
async function setState(params: SetStateParams): Promise<boolean> {
  try {
    // Extract the storage layout
    const { contractName, varName, path, value, contractAddress, artifacts, hre } = params;
    
    // Get the storage location for the variable/path
    const location = await getStorageLocation({
      contractName,
      varName,
      path,
      artifacts
    });
    
    if (!location) {
      console.error(`Cannot find storage location for ${varName} in ${contractName}`);
      return false;
    }
    
    // Set the value at the calculated storage location
    await setSlotValue({
      location,
      value,
      contractAddress,
      hre
    });
    
    return true;
  } catch (error: any) {
    console.error(`Error setting state: ${error.message}`);
    return false;
  }
}

export * from './types';
export * from './storage-layout';
export * from './slot-utils';

// Define the default artifacts path configuration
extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    // Add default config values if needed
    config.stateSetterConfig = {
      artifactsPath: config.paths.artifacts,
      storageLayoutsPath: path.join(process.cwd(), 'storage-layouts'),
      ...userConfig.stateSetterConfig,
    };
  }
);

// Add the StateSetterConfig property to the Config interface
declare module "hardhat/types" {
  interface HardhatConfig {
    stateSetterConfig: {
      artifactsPath: string;
      storageLayoutsPath: string;
    };
  }
  
  interface HardhatUserConfig {
    stateSetterConfig?: {
      artifactsPath?: string;
      storageLayoutsPath?: string;
    };
  }
  
  // Extend the HRE with our plugin API
  interface HardhatRuntimeEnvironment {
    stateSetter: {
      setState: (params: Omit<SetStateParams, 'artifacts' | 'hre'>) => Promise<boolean>;
      setSimpleState: (
        contractName: string,
        contractAddress: string,
        varName: string,
        value: any
      ) => Promise<boolean>;
      setMappingValue: (
        contractName: string,
        contractAddress: string,
        varName: string,
        key: any,
        value: any
      ) => Promise<boolean>;
      setArrayElement: (
        contractName: string,
        contractAddress: string,
        varName: string,
        index: number,
        value: any
      ) => Promise<boolean>;
      setStructField: (
        contractName: string,
        contractAddress: string,
        varName: string,
        fieldName: string,
        value: any
      ) => Promise<boolean>;
      setNestedState: (
        contractName: string,
        contractAddress: string,
        varName: string,
        path: string[],
        value: any
      ) => Promise<boolean>;
      setNestedMappingValue: (
        contractName: string,
        contractAddress: string,
        varName: string,
        keys: any[],
        value: any
      ) => Promise<boolean>;
      setNestedStructField: (
        contractName: string,
        contractAddress: string,
        varName: string,
        path: string[],
        fieldName: string,
        value: any
      ) => Promise<boolean>;
      _getStorageLayoutForType: (typeName: string) => any;
      setArrayLength: (
        contractName: string,
        contractAddress: string,
        varName: string,
        newLength: number
      ) => Promise<boolean>;
    };
  }
}

// Create extract-storage-layout task
task("extract-storage-layout", "Extracts storage layouts for all contracts")
  .setAction(async (_, hre) => {
    console.log("Extracting storage layouts for all contracts...");
    
    // Force recompilation to ensure the latest storage layouts
    await hre.run("compile", { force: true });
    
    // Create output directory if it doesn't exist
    const outputDir = hre.config.stateSetterConfig.storageLayoutsPath;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get all contract names
    const fullNames = await hre.artifacts.getAllFullyQualifiedNames();
    let extractedCount = 0;
    
    for (const fullName of fullNames) {
      try {
        // Skip interfaces and libraries
        if (fullName.includes(':Interface') || fullName.endsWith('Interface') || 
            fullName.includes(':Library') || fullName.endsWith('Library')) {
          continue;
        }
        
        const [sourceName, contractName] = fullName.split(':');
        const buildInfoFiles = fs.readdirSync(path.join(hre.config.paths.artifacts, "build-info"));
        
        for (const buildInfoFile of buildInfoFiles) {
          const buildInfoPath = path.join(hre.config.paths.artifacts, "build-info", buildInfoFile);
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
              hre.config.paths.artifacts,
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
    
    return extractedCount;
  });

// Add a check for the hardhat-storage-layout plugin
task("storage-layout-check", "Checks if hardhat-storage-layout plugin is installed")
  .setAction(async (_, hre) => {
    // Try to detect storage-layout plugin by checking typings
    const hasStorageLayoutPlugin = (hre as any).storageLayout !== undefined;
    if (!hasStorageLayoutPlugin) {
      console.warn("\x1b[33m%s\x1b[0m", 
        "Warning: hardhat-storage-layout plugin not detected. " +
        "Make sure it's installed and properly configured in your hardhat.config.js/ts. " +
        "Add this to your imports: import 'hardhat-storage-layout';"
      );
    } else {
      console.log("\x1b[32m%s\x1b[0m", "✅ hardhat-storage-layout plugin detected.");
    }
    
    return hasStorageLayoutPlugin;
  });

// Extend the Hardhat Runtime Environment
extendEnvironment((hre) => {
  // Add the stateSetter object to the HRE
  hre.stateSetter = lazyObject(() => {
    // Require the whole setState package if needed
    return {
      setState: async (params: Omit<SetStateParams, 'artifacts' | 'hre'>): Promise<boolean> => {
        // Access to the artifacts from the HRE
        const extendedParams: SetStateParams = {
          ...params,
          artifacts: hre.config.stateSetterConfig.artifactsPath,
          hre
        };
        
        // Check for hardhat-storage-layout plugin
        const hasStorageLayoutPlugin = !!(hre as any).storageLayout;
        console.log(hasStorageLayoutPlugin ? '✅ hardhat-storage-layout plugin detected.' : '⚠️ hardhat-storage-layout plugin not detected.');
        
        // Call the actual state setter function
        return await setState(extendedParams);
      },
      
      setSimpleState: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          contractAddress,
          varName,
          value
        });
      },
      
      setMappingValue: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        key: any,
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          contractAddress,
          varName,
          path: [key.toString()],
          value
        });
      },
      
      setArrayElement: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        index: number,
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          varName,
          path: [index.toString()],
          value,
          contractAddress
        });
      },
      
      setStructField: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        fieldName: string,
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          varName,
          path: [fieldName],
          value,
          contractAddress
        });
      },
      
      setNestedState: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        path: string[],
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          varName,
          path,
          value,
          contractAddress
        });
      },
      
      setNestedMappingValue: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        keys: any[],
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          varName,
          path: keys.map(k => k.toString()),
          value,
          contractAddress
        });
      },
      
      setNestedStructField: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        path: string[],
        fieldName: string,
        value: any
      ): Promise<boolean> => {
        return hre.stateSetter.setState({
          contractName,
          varName,
          path: [...path, fieldName],
          value,
          contractAddress
        });
      },
      
      // Add helper method for internal use
      _getStorageLayoutForType: function(typeName: string) {
        try {
          // Try to find the type in all available storage layouts
          const storageLayoutsDir = hre.config.stateSetterConfig.storageLayoutsPath;
          const fs = require('fs');
          const path = require('path');
          
          if (fs.existsSync(storageLayoutsDir)) {
            const files = fs.readdirSync(storageLayoutsDir);
            
            for (const file of files) {
              if (file.endsWith('.json')) {
                const layoutPath = path.join(storageLayoutsDir, file);
                const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
                
                if (layout.types && layout.types[typeName]) {
                  return layout.types[typeName];
                }
              }
            }
          }
          
          return null;
        } catch (error) {
          console.error(`Error in _getStorageLayoutForType:`, error);
          return null;
        }
      },
      
      // Add a new function to set array length
      setArrayLength: async (
        contractName: string,
        contractAddress: string,
        varName: string,
        newLength: number
      ): Promise<boolean> => {
        // Access to the artifacts from the HRE
        const params = {
          contractName,
          contractAddress,
          varName,
          path: ['length'], // Special path value to indicate array length
          value: newLength,
          artifacts: hre.config.stateSetterConfig.artifactsPath,
          hre
        };
        
        // Call the actual state setter function directly
        return await setState(params);
      }
    };
  });
});

// This is to support both ESM and CommonJS
export default {}; 