import { SetSlotValueParams, StorageLocation } from './types';
import { ethers } from 'ethers';

/**
 * Sets a value in a specific storage slot of a contract
 */
export async function setSlotValue(params: SetSlotValueParams): Promise<void> {
  const { location, value, contractAddress, hre } = params;
  
  // Convert the value to the appropriate format based on type
  const encodedValue = encodeValueForStorage(value, location);
  
  // Ensure slot is properly formatted
  const formattedSlot = formatSlot(location.slot);
  
  // If we have an offset, we need to read the current slot value first
  // and then update only the relevant bits
  if (location.offset !== undefined && location.offset > 0) {
    await setPartialSlotValue(
      hre,
      contractAddress,
      formattedSlot,
      encodedValue,
      location.offset,
      location.size
    );
  } else {
    // Set the entire slot value
    await hre.network.provider.send('hardhat_setStorageAt', [
      contractAddress,
      formattedSlot,
      encodedValue
    ]);
  }
}

/**
 * Formats a slot to ensure it's a proper hex string
 */
function formatSlot(slot: string): string {
  // If it's already a hex string with 0x prefix, return it
  if (slot.startsWith('0x')) {
    return slot;
  }
  
  // Try to parse it as BigInt first (handles numeric strings)
  try {
    const slotNumber = BigInt(slot);
    return `0x${slotNumber.toString(16)}`;
  } catch (e) {
    // If it's not a number but a hex string without prefix, add prefix
    if (/^[0-9a-fA-F]+$/.test(slot)) {
      return `0x${slot}`;
    }
  }
  
  // Default case - assume it's a hex string without prefix
  return `0x${slot}`;
}

/**
 * Sets part of a storage slot (for packed variables)
 */
async function setPartialSlotValue(
  hre: any,
  contractAddress: string,
  slot: string,
  value: string,
  offset: number,
  size: number
): Promise<void> {
  // Read the current slot value
  const currentValue = await hre.network.provider.send('eth_getStorageAt', [
    contractAddress,
    slot,
    'latest'
  ]);
  
  // Parse the current value as a large number
  const currentBigInt = BigInt(currentValue);
  
  // Parse the new value as a big integer
  const valueBigInt = BigInt(value);
  
  // Create a mask for the bits we want to change
  const mask = ((1n << BigInt(size * 8)) - 1n) << BigInt(offset * 8);
  
  // Clear the bits in the current value
  const clearedValue = currentBigInt & ~mask;
  
  // Shift the new value to the correct position
  const shiftedValue = (valueBigInt << BigInt(offset * 8)) & mask;
  
  // Combine the cleared value with the new value
  const resultValue = clearedValue | shiftedValue;
  
  // Convert to hex string with 0x prefix and pad to 32 bytes
  const resultHex = '0x' + resultValue.toString(16).padStart(64, '0');
  
  // Set the new storage value
  await hre.network.provider.send('hardhat_setStorageAt', [
    contractAddress,
    slot,
    resultHex
  ]);
}

/**
 * Encodes a value for storage based on its type
 */
export function encodeValueForStorage(value: any, location: StorageLocation): string {
  const { type, size } = location;
  
  // Handle different types
  if (type.startsWith('t_uint')) {
    return encodeUintForStorage(value, size);
  } else if (type.startsWith('t_int')) {
    return encodeIntForStorage(value, size);
  } else if (type.startsWith('t_bool')) {
    return encodeBoolForStorage(value);
  } else if (type.startsWith('t_address')) {
    return encodeAddressForStorage(value);
  } else if (type.startsWith('t_string') || type.startsWith('t_bytes')) {
    return encodeStringForStorage(value);
  } else if (type.startsWith('t_enum')) {
    return encodeUintForStorage(value, size);
  } else if (type.startsWith('t_contract')) {
    return encodeAddressForStorage(value);
  }
  
  // Default fallback
  return encodeUintForStorage(value, size);
}

/**
 * Encodes a uint value for storage
 */
function encodeUintForStorage(value: string | number | bigint, size: number): string {
  try {
    const bigIntValue = BigInt(value);
    // Make sure to use the full 32 bytes (64 hex characters) for the slot value
    const fullHex = bigIntValue.toString(16).padStart(64, '0');
    return '0x' + fullHex;
  } catch (error) {
    console.error('Error encoding uint value:', error);
    // If we can't convert to BigInt, return a default value of 0
    return '0x' + '0'.padStart(64, '0');
  }
}

/**
 * Encodes an int value for storage
 */
function encodeIntForStorage(value: string | number | bigint, size: number): string {
  let bigIntValue = BigInt(value);
  
  // Handle negative numbers
  if (bigIntValue < 0n) {
    // Two's complement representation
    const mask = (1n << BigInt(size * 8)) - 1n;
    bigIntValue = (bigIntValue & mask);
  }
  
  const hex = bigIntValue.toString(16).padStart(size * 2, '0');
  return '0x' + hex.padStart(64, '0');
}

/**
 * Encodes a boolean value for storage
 */
function encodeBoolForStorage(value: boolean): string {
  return value ? '0x0000000000000000000000000000000000000000000000000000000000000001'
               : '0x0000000000000000000000000000000000000000000000000000000000000000';
}

/**
 * Encodes an address value for storage
 */
function encodeAddressForStorage(value: string): string {
  // Remove 0x prefix if present
  if (value.startsWith('0x')) {
    value = value.slice(2);
  }
  
  return '0x' + value.toLowerCase().padStart(64, '0');
}

/**
 * Encodes a string value for storage
 * Note: This only works for short strings that fit in a single slot
 * For longer strings, we would need a different approach
 */
function encodeStringForStorage(value: string): string {
  if (value.length <= 31) {
    // Short string - encode length and characters directly
    let encoded = '';
    
    // Encode each character
    for (let i = 0; i < value.length; i++) {
      encoded += value.charCodeAt(i).toString(16).padStart(2, '0');
    }
    
    // Pad to the right
    encoded = encoded.padEnd(62, '0');
    
    // Add the length * 2 at the end
    encoded += (value.length * 2).toString(16).padStart(2, '0');
    
    return '0x' + encoded;
  } else {
    // For long strings, we'd need to handle this differently
    // This is a simplification - in reality, long strings are stored as:
    // - slot n: length*2 + 1
    // - keccak256(slot n): first 32 bytes
    // - keccak256(slot n) + 1: next 32 bytes, etc.
    throw new Error("Long strings not supported for direct storage setting");
  }
} 