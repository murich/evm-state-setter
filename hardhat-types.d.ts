import { HardhatRuntimeEnvironment } from "hardhat/types";

// Extend hardhat with our plugin API
declare module "hardhat/types" {
  interface HardhatRuntimeEnvironment {
    stateSetter: {
      setState: (params: Omit<import('./src/types').SetStateParams, 'artifacts' | 'hre'>) => Promise<boolean>;
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
      setArrayLength: (
        contractName: string,
        contractAddress: string,
        varName: string,
        newLength: number
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
    };
  }

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
} 