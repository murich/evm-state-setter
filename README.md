# Hardhat EVM State Setter

A Hardhat plugin for setting contract state variables directly using storage layouts.

## Overview

This plugin allows you to set any state variable in your smart contracts during testing without having to call setter functions. It works by:

1. Analyzing your contract's storage layout (integrates with hardhat-storage-layout plugin)
2. Finding the storage slot for any variable
3. Setting the value directly in that slot

This is useful for:
- Setting up complex test scenarios
- Testing edge cases that are difficult to reach through regular function calls
- Manipulating inherited contract state
- Modifying state in contracts without setter functions

## Requirements

- Hardhat v2.0.0 or higher
- Ethers v6.1.0 or higher
- Node.js v14 or higher

## Installation

```bash
npm install --save-dev hardhat-evm-state-setter hardhat-storage-layout
```

## Setup

1. Import and use both plugins in your Hardhat config:

```typescript
// hardhat.config.ts
import "hardhat-storage-layout";
import "hardhat-evm-state-setter";

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
  // Optional: Configure the plugin
  stateSetterConfig: {
    // Optional: Custom path to artifacts (defaults to config.paths.artifacts)
    artifactsPath: "./artifacts",
    // Optional: Custom path to storage layouts (defaults to ./storage-layouts)
    storageLayoutsPath: "./storage-layouts",
  },
  // ...
};
```

2. Compile your contracts to generate storage layouts:

```bash
npx hardhat compile --force
```

## Usage

The plugin adds a `stateSetter` object to the Hardhat Runtime Environment (HRE) with several helper functions:

### Basic Usage

```typescript
// In your test file
const { ethers } = require("hardhat");

describe("My Contract Tests", function() {
  it("should set a state variable", async function() {
    const MyContract = await ethers.getContractFactory("MyContract");
    const myContract = await MyContract.deploy();
    
    // Set a simple value
    await hre.stateSetter.setState({
      contractName: "MyContract",
      contractAddress: await myContract.getAddress(),
      varName: "myVariable",
      value: 42
    });
    
    // The contract's state has now been updated!
    const value = await myContract.myVariable();
    expect(value).to.equal(42);
  });
});
```

### Convenience Functions

The plugin provides convenience functions for common scenarios:

```typescript
// Set a simple variable
await hre.stateSetter.setSimpleState(
  "MyContract", 
  contractAddress, 
  "myVariable", 
  42
);

// Set a mapping value
await hre.stateSetter.setMappingValue(
  "MyContract", 
  contractAddress, 
  "myMapping", 
  "someKey", 
  "someValue"
);

// Set an array element
await hre.stateSetter.setArrayElement(
  "MyContract", 
  contractAddress, 
  "myArray", 
  1, // index
  99 // value
);

// Set a struct field
await hre.stateSetter.setStructField(
  "MyContract", 
  contractAddress, 
  "myStruct", 
  "fieldName", 
  "fieldValue"
);

// Set a nested mapping value
await hre.stateSetter.setNestedMappingValue(
  "MyContract", 
  contractAddress, 
  "nestedMapping", 
  ["key1", "key2"], 
  true
);
```

### Complex Path Access

You can set values in deeply nested structures using paths:

```typescript
// Set a field in a struct inside a mapping
await hre.stateSetter.setState({
  contractName: "MyContract",
  contractAddress: contractAddress,
  varName: "userInfo",
  path: ["0x123...", "balance"], // [mappingKey, structField]
  value: 1000000
});

// Set an element in an array field of a struct in a mapping
await hre.stateSetter.setState({
  contractName: "MyContract",
  contractAddress: contractAddress,
  varName: "userInfo",
  path: ["0x123...", "tokens", "2"], // [mappingKey, structArrayField, arrayIndex]
  value: 42
});
```

## Testing with the Plugin

The plugin is particularly useful in testing scenarios where you need to set up specific contract states. Below are comprehensive examples for testing with the plugin.

### Setup for Testing

First, ensure your test file imports Hardhat properly and references the type definitions:

```typescript
/// <reference path="../hardhat-types.d.ts" />
import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";

describe("Contract Tests", function () {
  let contractInstance;
  let ownerAddress;

  beforeEach(async function() {
    // Get signers
    const [owner] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    
    // Deploy your contract
    const Contract = await ethers.getContractFactory("YourContract");
    contractInstance = await Contract.deploy();
    await contractInstance.waitForDeployment();
  });
  
  // Tests go here...
});
```

### Testing Simple Values

Setting and testing simple values like uint, bool, and address:

```typescript
it("should set a simple uint value", async function() {
  const newValue = 42;
  
  // Set the value using our plugin
  await hre.stateSetter.setSimpleState(
    "YourContract",
    await contractInstance.getAddress(),
    "myUintVariable",
    newValue
  );
  
  // Verify the value was set correctly
  expect(await contractInstance.myUintVariable()).to.equal(newValue);
});

it("should set a boolean value", async function() {
  // Set a boolean value
  await hre.stateSetter.setSimpleState(
    "YourContract",
    await contractInstance.getAddress(),
    "myBoolVariable",
    false
  );
  
  // Verify
  expect(await contractInstance.myBoolVariable()).to.equal(false);
});

it("should set an address value", async function() {
  const testAddress = "0x0000000000000000000000000000000000000001";
  
  await hre.stateSetter.setSimpleState(
    "YourContract",
    await contractInstance.getAddress(),
    "myAddressVariable",
    testAddress
  );
  
  expect(await contractInstance.myAddressVariable()).to.equal(testAddress);
});
```

### Testing Mappings

Setting values in mappings and verifying them:

```typescript
it("should set a mapping value", async function() {
  const key = 42;
  const value = "Hello, World!";
  
  await hre.stateSetter.setMappingValue(
    "YourContract",
    await contractInstance.getAddress(),
    "myStringMapping", // mapping(uint => string)
    key,
    value
  );
  
  expect(await contractInstance.myStringMapping(key)).to.equal(value);
});

it("should set a nested mapping value", async function() {
  const address = "0x0000000000000000000000000000000000000001";
  const key = 5;
  const value = true;
  
  // For a mapping like: mapping(address => mapping(uint => bool))
  await hre.stateSetter.setState({
    contractName: "YourContract",
    varName: "myNestedMapping",
    path: [address, key.toString()],
    value: value,
    contractAddress: await contractInstance.getAddress()
  });
  
  expect(await contractInstance.myNestedMapping(address, key)).to.equal(value);
});
```

### Testing Arrays

Working with array elements:

```typescript
it("should set an array element", async function() {
  const index = 2;
  const value = 999;
  
  // For a dynamic or fixed-size array
  await hre.stateSetter.setArrayElement(
    "YourContract",
    await contractInstance.getAddress(),
    "myArray",
    index,
    value
  );
  
  expect(await contractInstance.myArray(index)).to.equal(value);
});
```

### Testing Structs

Setting struct fields individually or as a whole:

```typescript
it("should set a struct field", async function() {
  const contractAddress = await contractInstance.getAddress();
  
  // For a struct like: struct Person { string name; uint age; bool active; }
  await hre.stateSetter.setStructField(
    "YourContract",
    contractAddress,
    "myPerson", // a Person struct
    "age",
    42
  );
  
  const person = await contractInstance.myPerson();
  expect(person.age).to.equal(42);
});

it("should set multiple struct fields", async function() {
  const contractAddress = await contractInstance.getAddress();
  
  // Set multiple fields one by one
  await hre.stateSetter.setStructField(
    "YourContract",
    contractAddress,
    "myPerson",
    "name",
    "Alice"
  );
  
  await hre.stateSetter.setStructField(
    "YourContract",
    contractAddress,
    "myPerson",
    "active",
    true
  );
  
  const person = await contractInstance.myPerson();
  expect(person.name).to.equal("Alice");
  expect(person.active).to.equal(true);
});
```

### Testing Complex Nested Structures

The plugin excels at setting deeply nested state:

```typescript
it("should set a nested struct in a mapping", async function() {
  const userAddress = "0x0000000000000000000000000000000000000001";
  const contractAddress = await contractInstance.getAddress();
  
  // For mapping(address => Person)
  await hre.stateSetter.setState({
    contractName: "YourContract",
    varName: "peopleByAddress",
    path: [userAddress, "name"],
    value: "Bob",
    contractAddress
  });
  
  await hre.stateSetter.setState({
    contractName: "YourContract",
    varName: "peopleByAddress",
    path: [userAddress, "age"],
    value: 30,
    contractAddress
  });
  
  const person = await contractInstance.peopleByAddress(userAddress);
  expect(person.name).to.equal("Bob");
  expect(person.age).to.equal(30);
});
```

### Debugging Storage Layout

Sometimes it's helpful to examine the storage layout directly:

```typescript
it("should inspect storage slots", async function() {
  const contractAddress = await contractInstance.getAddress();
  
  // Read several storage slots to understand the layout
  console.log("Storage slot contents:");
  for (let i = 0; i < 10; i++) {
    const slotValue = await hre.network.provider.send("eth_getStorageAt", [
      contractAddress,
      `0x${i.toString(16)}`,
      "latest"
    ]);
    console.log(`Slot ${i}:`, slotValue);
  }
  
  // Now you can make informed decisions about which slots to modify
});
```

### Testing Tips & Best Practices

1. **Extract Storage Layouts First**: Always ensure you've run `npx hardhat extract-storage-layout` before testing to ensure the plugin has access to the latest storage layout information.

2. **Type Safety**: Use the hardhat-types.d.ts reference in your test files to ensure type checking for the plugin methods.

3. **Complex Types**: For complex nested structures (like arrays of structs inside mappings), break down the state setting into smaller, sequential operations.

4. **Verification**: Always verify the state was set correctly by reading it back through contract methods.

5. **Gas Savings**: Using the plugin to set state directly is more gas-efficient than calling contract methods in tests, especially for complex setup.

6. **Error Handling**: The plugin provides descriptive error messages. If you encounter an error about missing storage layout, make sure your Solidity compiler settings are correctly configured to output storage layouts.

7. **Snapshots**: Combine with Hardhat's snapshot feature to create complex states, take a snapshot, and revert to it between tests.

### Advanced Example: TokenVault Contract

The repository includes a comprehensive example with a TokenVault contract that demonstrates how to test complex storage patterns:

```bash
# Run the TokenVault tests
npx hardhat test test/TokenVault.test.ts
```

This example tests:

- Inheritance patterns (TokenVault inherits from AccessControl)
- Enum values and their manipulation
- Multi-level mappings with different key types
- Fixed-size arrays and dynamic arrays
- Nested structures and complex storage patterns

For more details on the patterns tested and current limitations, see [README-Tests.md](./README-Tests.md).

## Task Commands

This plugin adds the following tasks to Hardhat:

```bash
# Extract storage layouts for all contracts
npx hardhat extract-storage-layout

# Check if the hardhat-storage-layout plugin is properly installed
npx hardhat storage-layout-check
```

## Troubleshooting

If you encounter issues with the plugin:

1. Ensure you've imported both `hardhat-storage-layout` and `hardhat-evm-state-setter` in your config
2. Make sure your Solidity compiler settings include `outputSelection` for `storageLayout`
3. Run `npx hardhat compile --force` to regenerate artifacts with storage layout information
4. Run `npx hardhat extract-storage-layout` to extract and ensure storage layouts are available
5. Check for detailed error messages which will guide you on how to resolve specific issues

## Limitations

- Works only with Hardhat's local development networks
- String manipulation is limited to short strings (≤31 bytes)
- Complex types may require specific encoding based on your contract's storage layout

## License

MIT
