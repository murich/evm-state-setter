import { StorageLocation, StorageLocationParams, VarLocation } from './types';
import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';

/**
 * Gets the storage location for a variable
 */
export async function getStorageLocation(params: StorageLocationParams): Promise<StorageLocation> {
  const { contractName, varName, path: varPath, artifacts } = params;
  
  // Load storage layout from contract artifacts
  const storageLayout = await loadStorageLayout(contractName, artifacts);
  
  // Find the base variable location
  const varLocation = findVariableLocation(storageLayout, varName);
  if (!varLocation) {
    throw new Error(`Variable '${varName}' not found in contract '${contractName}'`);
  }
  
  // If we don't have a path, return the base variable location
  if (!varPath || varPath.length === 0) {
    return {
      slot: varLocation.slot,
      offset: varLocation.offset,
      size: varLocation.size,
      type: varLocation.type,
      children: varLocation.children
    };
  }
  
  // Import functions dynamically to avoid circular dependencies
  const { resolveArrayPath, resolveMappingPath, resolveStructPath } = require('./path-utils');
  
  // Handle different types of complex variables
  const varType = varLocation.type;
  
  if (varType.startsWith('t_mapping')) {
    // Handle mapping
    return resolveMappingPath(varLocation, varPath);
  } else if (varType.startsWith('t_array')) {
    // Handle array
    return resolveArrayPath(varLocation, varPath);
  } else if (varType.startsWith('t_struct')) {
    // Handle struct
    return resolveStructPath(varLocation, varPath);
  }
  
  throw new Error(`Unsupported variable type for path access: ${varType}`);
}

/**
 * Loads the storage layout from contract artifacts
 */
export async function loadStorageLayout(contractName: string, artifactsPath: string): Promise<any> {
  try {
    // Try to get access to Hardhat's Runtime Environment to use hardhat-storage-layout plugin directly
    const hre = (global as any).hre || undefined;
    
    // Method 1: Try to use hardhat-storage-layout plugin directly if available
    if (hre && (hre as any).storageLayout && typeof (hre as any).storageLayout.getStorageLayout === 'function') {
      try {
        const storageLayout = await (hre as any).storageLayout.getStorageLayout(contractName);
        if (storageLayout) {
          return storageLayout;
        }
      } catch (err) {
        console.log(`Could not get storage layout via plugin API for ${contractName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    
    // Method 2: Try the dedicated storage layouts directory first (from extract-storage-layout task)
    const storageLayoutsDir = hre?.config?.stateSetterConfig?.storageLayoutsPath || 
                             path.join(process.cwd(), 'storage-layouts');
    
    if (fs.existsSync(storageLayoutsDir)) {
      const layoutPath = path.join(storageLayoutsDir, `${contractName}.json`);
      
      if (fs.existsSync(layoutPath)) {
        const storageLayout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
        return storageLayout;
      }
    }
    
    // Method 3: First try the standard path pattern for direct artifacts
    const artifactPath = path.join(artifactsPath, `${contractName}.json`);
    
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      if (artifact.storageLayout) {
        return artifact.storageLayout;
      }
    }
    
    // Method 4: If not found, try the alternative path pattern for Hardhat artifacts
    const alternativeArtifactPath = path.join(
      artifactsPath, 
      'contracts',
      `${contractName}.sol`,
      `${contractName}.json`
    );
    
    if (fs.existsSync(alternativeArtifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(alternativeArtifactPath, 'utf8'));
      
      // Check if the storageLayout is present
      if (artifact.storageLayout) {
        return artifact.storageLayout;
      }
      
      // If it's not directly present, check if buildInfo reference exists
      if (artifact.buildInfo) {
        // Get the build info path
        const buildInfoPath = path.join(
          path.dirname(path.dirname(alternativeArtifactPath)),
          'build-info',
          `${artifact.buildInfo}.json`
        );
        
        if (fs.existsSync(buildInfoPath)) {
          const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
          const output = buildInfo.output || {};
          
          // Find the contract in the build info
          for (const sourceName in output.contracts || {}) {
            if (output.contracts[sourceName][contractName]) {
              const contract = output.contracts[sourceName][contractName];
              if (contract.storageLayout) {
                return contract.storageLayout;
              }
            }
          }
        }
      }
    }
    
    // Method 5: Look directly in build-info directory
    const buildInfoDir = path.join(artifactsPath, 'build-info');
    if (fs.existsSync(buildInfoDir)) {
      const buildInfoFiles = fs.readdirSync(buildInfoDir);
      
      for (const buildInfoFile of buildInfoFiles) {
        const buildInfoPath = path.join(buildInfoDir, buildInfoFile);
        const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
        const output = buildInfo.output || {};
        
        // Look through all contracts in the build info
        for (const sourceName in output.contracts || {}) {
          if (output.contracts[sourceName][contractName]) {
            const contract = output.contracts[sourceName][contractName];
            if (contract.storageLayout) {
              return contract.storageLayout;
            }
          }
        }
      }
    }
    
    // If we still haven't found the storage layout, try to extract it if we have access to HRE
    if (hre) {
      console.warn(`Storage layout not found for '${contractName}', attempting to extract it automatically...`);
      try {
        const result = await hre.run('extract-storage-layout');
        
        // If extraction was successful, try to load the storage layout again
        if (result > 0) {
          const storageLayoutsDir = hre.config.stateSetterConfig.storageLayoutsPath;
          const layoutPath = path.join(storageLayoutsDir, `${contractName}.json`);
          
          if (fs.existsSync(layoutPath)) {
            const storageLayout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
            return storageLayout;
          }
        }
      } catch (error) {
        console.error(`Failed to automatically extract storage layout: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // If we STILL haven't found the storage layout, throw a detailed error
    throw new Error(
      `Storage layout not found for '${contractName}'.\n` +
      `This is required for the state setter to work properly.\n\n` +
      `To resolve this issue:\n` +
      `1. Ensure the 'hardhat-storage-layout' plugin is installed and configured in your hardhat.config.js/ts:\n` +
      `   import 'hardhat-storage-layout';\n\n` +
      `2. Add the following to your Solidity compiler settings:\n` +
      `   solidity: {\n` +
      `     settings: {\n` +
      `       outputSelection: {\n` +
      `         "*": { "*": ["storageLayout"] }\n` +
      `       }\n` +
      `     }\n` +
      `   }\n\n` +
      `3. Run 'npx hardhat compile --force' to regenerate artifacts with storage layout information.\n` +
      `4. Run 'npx hardhat extract-storage-layout' to extract storage layouts for all contracts.`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error loading storage layout for '${contractName}': ${errorMessage}`);
  }
}

/**
 * Finds a variable's location in the storage layout
 */
export function findVariableLocation(storageLayout: any, varName: string): VarLocation | null {
  const { storage, types } = storageLayout;
  
  // Find the variable in the storage layout
  const storageVar = storage.find((item: any) => item.label === varName);
  if (!storageVar) {
    return null;
  }
  
  // Get the variable's type info
  const varType = types[storageVar.type];
  if (!varType) {
    throw new Error(`Type information not found for variable '${varName}'`);
  }
  
  // Create the location object
  const location: VarLocation = {
    name: varName,
    slot: storageVar.slot,
    offset: storageVar.offset,
    size: parseInt(varType.numberOfBytes || '0', 10),
    type: storageVar.type,
    // Include the full storage layout info for resolving nested types later
    structInfo: storageLayout
  };
  
  // Handle complex types (struct, mapping, array)
  if (varType.members && varType.members.length > 0) {
    // Handle structs
    location.children = varType.members.map((member: any) => {
      return {
        name: member.label,
        slot: calculateMemberSlot(location.slot, member.offset),
        offset: member.offset % 32,
        size: parseInt(types[member.type].numberOfBytes || '0', 10),
        type: member.type,
        structInfo: storageLayout
      };
    });
  } 
  // If this is a struct but no members are available in the storage layout
  else if (storageVar.type.startsWith('t_struct')) {
    // Log a warning and don't create synthetic children - let the path resolver handle this
    console.warn(`No struct members found for ${varName} (${storageVar.type}). Struct fields cannot be accessed without storage layout information.`);
  }
  
  return location;
}

/**
 * Helper to calculate next struct slot
 */
function calculateNextStructSlot(baseSlot: string, increment: number): string {
  const slotBigInt = baseSlot.startsWith('0x') 
    ? ethers.getBigInt(baseSlot)
    : BigInt(parseInt(baseSlot, 10));
  return `0x${(slotBigInt + BigInt(increment + 1)).toString(16)}`;
}

/**
 * Calculates a struct member's slot based on parent slot and offset
 */
function calculateMemberSlot(parentSlot: string, offset: number): string {
  const slotNumber = ethers.getBigInt(parentSlot);
  const offsetSlot = Math.floor(offset / 32);
  return (slotNumber + BigInt(offsetSlot)).toString(16);
}

/**
 * Calculates the keccak256 hash of a slot and key for mappings
 */
export function calculateMappingSlot(slot: string, key: string): string {
  try {
    // For small numeric slots (like "3", "4", etc.), handle them specially
    if (/^\d+$/.test(slot) && parseInt(slot, 10) < 1000) {
      const slotNum = parseInt(slot, 10);
      // Create a 32-byte hex string for the slot
      const slotHex = slotNum.toString(16).padStart(64, '0');
      const slotBytes = `0x${slotHex}`;
      
      // For small numeric keys (like 1, 2, 3, 4, etc.), handle them directly
      if (/^\d+$/.test(key) && parseInt(key, 10) < 1000) {
        const keyNum = parseInt(key, 10);
        // Create a 32-byte hex string with the key at the left (most significant position)
        const keyHex = keyNum.toString(16).padStart(64, '0');
        const keyBytes = `0x${keyHex}`;
        
        // Concatenate key and slot for hashing
        const packedData = ethers.concat([keyBytes, slotBytes]);
        
        // Calculate keccak256 hash
        return ethers.keccak256(packedData);
      }
      
      // For other keys
      let keyBytes: string;
      
      if (key.startsWith('0x')) {
        // It's an address or hex value
        // Remove 0x prefix and pad to 64 characters (32 bytes)
        const paddedKey = key.slice(2).padStart(64, '0');
        keyBytes = `0x${paddedKey}`;
      } else if (/^\d+$/.test(key)) {
        // It's a numeric string
        const keyBigInt = BigInt(key);
        const keyHex = keyBigInt.toString(16).padStart(64, '0');
        keyBytes = `0x${keyHex}`;
      } else {
        // It's a string - hash it
        keyBytes = ethers.keccak256(ethers.toUtf8Bytes(key));
      }
      
      // Concatenate key and slot for hashing
      const packedData = ethers.concat([keyBytes, slotBytes]);
      
      // Calculate keccak256 hash
      return ethers.keccak256(packedData);
    }
    
    // Regular approach for other slots
    // Ensure the slot has 0x prefix
    const slotFormatted = slot.startsWith('0x') ? slot : `0x${slot}`;
    
    // Create a 32-byte slot value using BigInt
    const slotBigInt = ethers.getBigInt(slotFormatted);
    const slotHex = slotBigInt.toString(16).padStart(64, '0');
    const slotBytes = `0x${slotHex}`;
    
    // Process the key based on whether it's an address, number, or string
    let keyBytes: string;
    
    if (key.startsWith('0x')) {
      // It's an address or hex value
      // Remove 0x prefix and pad to 64 characters (32 bytes)
      const paddedKey = key.slice(2).padStart(64, '0');
      keyBytes = `0x${paddedKey}`;
    } else if (/^\d+$/.test(key)) {
      // It's a number
      const keyBigInt = BigInt(key);
      const keyHex = keyBigInt.toString(16).padStart(64, '0');
      keyBytes = `0x${keyHex}`;
    } else {
      // It's a string - use keccak256 of its UTF-8 bytes
      keyBytes = ethers.keccak256(ethers.toUtf8Bytes(key));
    }
    
    // Concatenate key and slot for hashing
    const packedData = ethers.concat([keyBytes, slotBytes]);
    
    // Calculate keccak256 hash
    return ethers.keccak256(packedData);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error calculating mapping slot: ${errorMessage}`);
  }
}

/**
 * Calculates the slot for an array element
 */
export function calculateArraySlot(baseSlot: string, index: number): string {
  // Ensure the slot is properly formatted for ethers
  const slotFormatted = baseSlot.startsWith('0x') ? baseSlot : `0x${baseSlot}`;
  const slotNumber = ethers.getBigInt(slotFormatted);
  const indexBigInt = BigInt(index);
  const finalSlot = slotNumber + indexBigInt;
  return `0x${finalSlot.toString(16)}`;
}

/**
 * Calculates the slot for a dynamic array element
 */
export function calculateDynamicArraySlot(baseSlot: string, index: number | string): string {
  // Special case: if the index is 'length', return the base slot itself
  // This is where Solidity stores the array length
  if (index === 'length' || index === '.length') {
    return baseSlot;
  }
  
  // Convert index to a number if it's a string
  const indexNumber = typeof index === 'string' ? parseInt(index, 10) : index;
  
  // For array elements, calculate the new slot using keccak256(slot) + index
  const baseSlotBI = BigInt(baseSlot);
  const hash = ethers.keccak256('0x' + baseSlotBI.toString(16).padStart(64, '0'));
  const hashBI = BigInt(hash);
  return (hashBI + BigInt(indexNumber)).toString();
} 