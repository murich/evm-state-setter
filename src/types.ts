import { HardhatRuntimeEnvironment } from 'hardhat/types';

/**
 * Options for the state setter
 */
export interface StateSetterOptions {
  /** The Hardhat artifacts directory */
  artifacts: string;
  /** The Hardhat Runtime Environment */
  hre: HardhatRuntimeEnvironment;
}

/**
 * Parameters for the setState function
 */
export interface SetStateParams {
  /** The name of the contract */
  contractName: string;
  /** The name of the variable to set */
  varName: string;
  /** The value to set */
  value: any;
  /** Optional path within variable for complex types */
  path?: string[];
  /** The address of the deployed contract */
  contractAddress: string;
  /** The hardhat artifacts directory */
  artifacts: string;
  /** The Hardhat Runtime Environment */
  hre: HardhatRuntimeEnvironment;
}

/**
 * Parameters for getting storage location
 */
export interface StorageLocationParams {
  /** The name of the contract */
  contractName: string;
  /** The name of the variable to get location for */
  varName: string;
  /** Optional path within variable for complex types */
  path?: string[];
  /** The hardhat artifacts directory */
  artifacts: string;
}

/**
 * Parameters for setting a slot value
 */
export interface SetSlotValueParams {
  /** The storage location to set */
  location: StorageLocation;
  /** The value to set */
  value: any;
  /** The address of the deployed contract */
  contractAddress: string;
  /** The Hardhat Runtime Environment */
  hre: HardhatRuntimeEnvironment;
}

/**
 * Storage layout information 
 */
export interface StorageLayoutInfo {
  /** Type definitions */
  types: Record<string, any>;
  /** Storage variables */
  storage: any[];
}

/**
 * Storage location information
 */
export interface StorageLocation {
  /** The slot number */
  slot: string;
  /** The offset within the slot (for packed variables) */
  offset?: number;
  /** The size of the variable in bytes */
  size: number;
  /** The type of the variable */
  type: string;
  /** For complex types, array of individual var locations */
  children?: VarLocation[];
}

/**
 * Location information for a variable or a child in a complex type
 */
export interface VarLocation {
  /** Name of the variable or field */
  name: string;
  /** Storage slot */
  slot: string;
  /** Offset within the slot */
  offset?: number;
  /** Size in bytes */
  size: number;
  /** Type information */
  type: string;
  /** For complex types, nested locations */
  children?: VarLocation[];
  /** Storage layout information for resolving nested types */
  structInfo?: StorageLayoutInfo;
  /** Added field to support parent reference for improved struct resolution */
  parent?: {
    types?: Record<string, any>;
    [key: string]: any;
  };
} 