import { StorageLocation, VarLocation } from './types';
import { calculateArraySlot, calculateDynamicArraySlot, calculateMappingSlot } from './storage-layout';
import { ethers } from 'ethers';

/**
 * Resolves a mapping path to find the correct storage slot
 */
export function resolveMappingPath(varLocation: VarLocation, path: string[]): StorageLocation {
  // The first path element is the mapping key
  const key = path[0];
  
  // Parse the mapping type to get key and value types
  let keyType = 't_uint256'; // Default 
  let valueType = 't_bool';  // Default
  const type = varLocation.type;
  
  // Extract key type and value type from mapping type
  try {
    if (type.startsWith('t_mapping(')) {
      // Get everything between t_mapping( and the last )
      const endParenIndex = type.lastIndexOf(')');
      if (endParenIndex > 10) {
        const innerContent = type.substring(10, endParenIndex);
        
        // Try arrow format first (t_mapping(keyType=>valueType))
        if (innerContent.includes('=>')) {
          const parts = innerContent.split('=>');
          keyType = parts[0].trim();
          valueType = parts[1].trim();
        } 
        // Then try comma format (t_mapping(keyType,valueType))
        else if (innerContent.includes(',')) {
          const parts = innerContent.split(',');
          keyType = parts[0].trim();
          valueType = parts[1].trim();
        }
        // If neither pattern matches, try to extract at least the key type
        else {
          // Try to extract at least the key type
          const match = innerContent.match(/^(t_[a-z0-9_]+)/);
          if (match) {
            keyType = match[1];
          }
        }
      }
    }
  } catch (error: any) {
    console.warn(`Error parsing mapping type '${type}': ${error.message}. Using defaults.`);
  }
  
  // Format the key based on its type
  let formattedKey = key;
  if (keyType.includes('t_address')) {
    // Make sure we have the full address format
    formattedKey = key.startsWith('0x') ? key : `0x${key}`;
  } else if (keyType.includes('t_uint') || keyType.includes('t_int')) {
    // Ensure numeric format for keys
    try {
      formattedKey = BigInt(key).toString();
    } catch (error) {
      // If we can't parse as BigInt, just use the key as is
      console.warn(`Cannot parse key '${key}' as BigInt, using as is.`);
    }
  }
  
  // Calculate the storage slot for this key
  const mappingSlot = calculateMappingSlot(varLocation.slot, formattedKey);
  
  // If there are no more path elements, return the slot
  if (path.length === 1) {
    return {
      slot: mappingSlot,
      size: getSizeForType(valueType),
      type: valueType
    };
  }
  
  // For nested mappings, we need to continue resolving
  if (valueType.startsWith('t_mapping')) {
    // Create a new "virtual" variable location for the inner mapping
    const innerMappingLocation: VarLocation = {
      name: 'innerMapping',
      slot: mappingSlot,
      size: 32, // Mappings always take a full slot
      type: valueType
    };
    
    // Recursively resolve the rest of the path
    return resolveMappingPath(innerMappingLocation, path.slice(1));
  }
  
  // For mappings to arrays
  if (valueType.startsWith('t_array')) {
    const innerArrayLocation: VarLocation = {
      name: 'innerArray',
      slot: mappingSlot,
      size: 32,
      type: valueType
    };
    
    return resolveArrayPath(innerArrayLocation, path.slice(1));
  }
  
  // For mappings to structs
  if (valueType.startsWith('t_struct')) {
    // Try to extract struct name and ID for better error messages
    const structMatch = valueType.match(/t_struct\(([^)]*)\)(\d+)_storage/);
    const structName = structMatch && structMatch[1] ? structMatch[1] : 'unknown';
    
    // Check if the parent variable has struct info in its children 
    let structChildren = null;
    
    if (varLocation.structInfo && varLocation.structInfo.types) {
      const types = varLocation.structInfo.types;
      // Find the struct definition in the types
      const structType = Object.values(types).find((t: any) => {
        return t.label === `struct ${structName}` || 
               t.label === `struct TestContract.${structName}` ||
               (structMatch && t.label === `struct ${structMatch[1]}`);
      });
      
      if (structType && structType.members) {
        // Create children from the struct members
        structChildren = structType.members.map((member: any) => {
          return {
            name: member.label,
            slot: calculateRelativeSlot(mappingSlot, member.slot || '0'),
            offset: member.offset || 0,
            size: parseInt(types[member.type]?.numberOfBytes || '32', 10),
            type: member.type
          };
        });
      }
    }
    
    const innerStructLocation: VarLocation = {
      name: structName,
      slot: mappingSlot,
      size: 32,
      type: valueType,
      children: structChildren
    };
    
    return resolveStructPath(innerStructLocation, path.slice(1));
  }
  
  // For any other value type, return a simple location
  return {
    slot: mappingSlot,
    size: getSizeForType(valueType),
    type: valueType
  };
}

/**
 * Helper to calculate relative slot for struct members
 */
function calculateRelativeSlot(baseSlot: string, relativeSlot: string): string {
  const baseSlotBigInt = baseSlot.startsWith('0x') 
    ? ethers.getBigInt(baseSlot)
    : BigInt(parseInt(baseSlot, 10));
  
  const relativeSlotNum = parseInt(relativeSlot, 10);
  return `0x${(baseSlotBigInt + BigInt(relativeSlotNum)).toString(16)}`;
}

/**
 * Resolves an array path to find the correct storage slot
 */
export function resolveArrayPath(varLocation: VarLocation, path: string[]): StorageLocation {
  if (!path || path.length === 0) {
    return {
      slot: varLocation.slot,
      offset: varLocation.offset,
      size: varLocation.size,
      type: varLocation.type
    };
  }

  const index = path[0];
  const remainingPath = path.slice(1);
  
  // Check if we're looking for array length
  if (index === 'length' || index === '.length') {
    // For length, we return the base slot of the array
    // but we need to set the type to uint256 since that's the type of length
    const lengthLocation: VarLocation = {
      name: `${varLocation.name}.length`,
      slot: varLocation.slot, // Length is stored at the base slot
      offset: 0,
      size: 32, // uint256 size
      type: 't_uint256', // Length is always uint256
    };
    
    // If there are more parts in the path, continue resolution
    // (though this is unlikely for length)
    if (remainingPath.length > 0) {
      return resolveStructPath(lengthLocation, remainingPath);
    }
    
    return {
      slot: lengthLocation.slot,
      offset: lengthLocation.offset,
      size: lengthLocation.size,
      type: lengthLocation.type
    };
  }
  
  // Normal array element access
  let elementSlot: string;
  
  // Check array type
  if (varLocation.type.includes('t_array') && varLocation.type.includes('dyn')) {
    // Dynamic array
    elementSlot = calculateDynamicArraySlot(varLocation.slot, index);
  } else {
    // Fixed size array
    elementSlot = calculateArraySlot(varLocation.slot, parseInt(index, 10));
  }
  
  // Get the element type from the array type
  const typeMatch = varLocation.type.match(/t_array\((.*?)\)/);
  if (!typeMatch || !typeMatch[1]) {
    throw new Error(`Invalid array type: ${varLocation.type}`);
  }
  
  const elementType = typeMatch[1];
  
  // If this is the last element in the path, return the slot
  if (path.length === 1) {
    return {
      slot: elementSlot,
      size: getSizeForType(elementType),
      type: elementType
    };
  }
  
  // For arrays of complex types, continue resolving the path
  if (elementType.startsWith('t_struct')) {
    const innerStructLocation: VarLocation = {
      name: 'innerStruct',
      slot: elementSlot,
      size: getSizeForType(elementType),
      type: elementType,
      children: varLocation.children
    };
    
    return resolveStructPath(innerStructLocation, path.slice(1));
  }
  
  // For arrays of arrays
  if (elementType.startsWith('t_array')) {
    const innerArrayLocation: VarLocation = {
      name: 'innerArray',
      slot: elementSlot,
      size: 32,
      type: elementType
    };
    
    return resolveArrayPath(innerArrayLocation, path.slice(1));
  }
  
  // For arrays of mappings
  if (elementType.startsWith('t_mapping')) {
    const innerMappingLocation: VarLocation = {
      name: 'innerMapping',
      slot: elementSlot,
      size: 32,
      type: elementType
    };
    
    return resolveMappingPath(innerMappingLocation, path.slice(1));
  }
  
  throw new Error(`Unsupported nested array element type: ${elementType}`);
}

/**
 * Resolves a struct path to find the correct storage slot
 */
export function resolveStructPath(varLocation: VarLocation, path: string[]): StorageLocation {
  // The first path element is the struct field name
  const fieldName = path[0];
  
  // Check if the variable has children
  if (!varLocation.children || varLocation.children.length === 0) {
    // Extract struct name for better error message
    const structMatch = varLocation.type.match(/t_struct\((.*?)\)/);
    const structName = structMatch && structMatch[1] ? structMatch[1] : 'unknown';
    
    console.log(`DEBUG: Missing children for struct ${structName}. Type: ${varLocation.type}`);
    console.log(`DEBUG: Full varLocation:`, JSON.stringify(varLocation, null, 2));
    
    // Look for children in the parent's type information if available
    if (varLocation.parent && varLocation.parent.types && varLocation.type) {
      const structInfo = varLocation.parent.types[varLocation.type];
      if (structInfo && structInfo.members) {
        console.log(`DEBUG: Found struct info in parent types:`, JSON.stringify(structInfo, null, 2));
        varLocation.children = structInfo.members;
      }
    }
    
    // If still no children, try to extract from hre
    if (!varLocation.children || varLocation.children.length === 0) {
      try {
        const hre = (global as any).hre;
        if (hre && hre.stateSetter && hre.stateSetter._getStorageLayoutForType) {
          const structInfo = hre.stateSetter._getStorageLayoutForType(varLocation.type);
          if (structInfo && structInfo.members) {
            console.log(`DEBUG: Found struct info via HRE:`, JSON.stringify(structInfo, null, 2));
            varLocation.children = structInfo.members;
          }
        }
      } catch (e) {
        console.log(`DEBUG: Error while trying to get struct info from HRE:`, e);
      }
    }
    
    // If still no children, throw the error
    if (!varLocation.children || varLocation.children.length === 0) {
      // Throw a clear error - we need complete storage layout information
      throw new Error(
        `No struct members information found for ${structName}.\n` +
        `This indicates that the storage layout metadata is incomplete.\n` +
        `To resolve this issue:\n` +
        `1. Ensure you have 'hardhat-storage-layout' plugin installed and properly configured.\n` +
        `2. Add the following to your hardhat.config.js/ts:\n\n` +
        `   solidity: {\n` +
        `     settings: {\n` +
        `       outputSelection: {\n` +
        `         "*": { "*": ["storageLayout"] }\n` +
        `       }\n` +
        `     }\n` +
        `   }\n\n` +
        `3. Run 'npx hardhat compile --force' to regenerate artifacts with storage layout information.\n` +
        `4. You may need to use 'npx hardhat run scripts/extract-storage-layout.ts' to ensure layout info is accessible.`
      );
    }
  }
  
  // Find the field in the struct children
  const field = varLocation.children.find(child => child.name === fieldName);
  if (!field) {
    throw new Error(`Field not found in struct: ${fieldName}. Available fields: ${varLocation.children.map(c => c.name).join(', ')}`);
  }
  
  // If there are no more path elements, return the field location
  if (path.length === 1) {
    return {
      slot: field.slot,
      offset: field.offset,
      size: field.size,
      type: field.type
    };
  }
  
  // For fields that are complex types, we need to continue resolving
  if (field.type.startsWith('t_struct')) {
    // Pass the parent types if available
    if (varLocation.parent && varLocation.parent.types) {
      field.parent = varLocation.parent;
    }
    return resolveStructPath(field, path.slice(1));
  }
  
  if (field.type.startsWith('t_mapping')) {
    return resolveMappingPath(field, path.slice(1));
  }
  
  if (field.type.startsWith('t_array')) {
    return resolveArrayPath(field, path.slice(1));
  }
  
  throw new Error(`Unsupported nested struct field type: ${field.type}`);
}

/**
 * Helper function to calculate the next slot
 */
function calculateNextSlot(slot: string): string {
  const slotBigInt = slot.startsWith('0x') 
    ? ethers.getBigInt(slot)
    : BigInt(parseInt(slot, 10));
  return `0x${(slotBigInt + 1n).toString(16)}`;
}

/**
 * Gets the size for a solidity type
 */
function getSizeForType(type: string): number {
  if (type.startsWith('t_uint8') || type.startsWith('t_bool')) {
    return 1;
  }
  
  if (type.startsWith('t_uint16')) {
    return 2;
  }
  
  if (type.startsWith('t_uint32')) {
    return 4;
  }
  
  if (type.startsWith('t_uint64')) {
    return 8;
  }
  
  if (type.startsWith('t_uint128')) {
    return 16;
  }
  
  // Default to full slot for other types
  return 32;
} 