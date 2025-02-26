/// <reference path="../hardhat-types.d.ts" />

import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  // Get a signer
  const [deployer] = await ethers.getSigners();
  
  // Deploy the test contract
  console.log("Deploying TestContract...");
  const TestContract = await ethers.getContractFactory("TestContract");
  const testContract = await TestContract.deploy();
  await testContract.waitForDeployment();
  
  const contractAddress = await testContract.getAddress();
  console.log(`TestContract deployed to: ${contractAddress}`);
  
  // 1. Set a simple variable
  console.log("\nSetting simpleUint to 999...");
  await hre.stateSetter.setSimpleState(
    "TestContract",
    contractAddress,
    "simpleUint",
    999
  );
  
  // Read the value to verify
  const simpleUint = await testContract.simpleUint();
  console.log(`simpleUint value: ${simpleUint}`);
  
  // 2. Set a mapping value
  console.log("\nSetting stringMapping[42] to 'Magic Answer'...");
  await hre.stateSetter.setMappingValue(
    "TestContract",
    contractAddress,
    "stringMapping",
    42,
    "Magic Answer"
  );
  
  // Read the mapping to verify
  const mappingValue = await testContract.stringMapping(42);
  console.log(`stringMapping[42] value: ${mappingValue}`);
  
  // 3. Set a struct field
  console.log("\nSetting person.name to 'Alice Smith'...");
  await hre.stateSetter.setStructField(
    "TestContract",
    contractAddress,
    "person",
    "name",
    "Alice Smith"
  );
  
  // Read the struct to verify
  const person = await testContract.person();
  console.log(`person.name value: ${person.name}`);
  
  // 4. Set a complex nested value
  console.log("\nSetting nestedMapping for a new address...");
  const newAddr = "0x1111111111111111111111111111111111111111";
  
  await hre.stateSetter.setState({
    contractName: "TestContract",
    varName: "nestedMapping",
    path: [newAddr, "5"], // [mappingKey1, mappingKey2]
    value: true,
    contractAddress
  });
  
  // Read the nested mapping to verify
  const nestedValue = await testContract.nestedMapping(newAddr, 5);
  console.log(`nestedMapping[${newAddr}][5] value: ${nestedValue}`);
  
  // 5. Set an array element
  console.log("\nSetting uintArray[2] to 42...");
  await hre.stateSetter.setArrayElement(
    "TestContract",
    contractAddress,
    "uintArray",
    2,
    42
  );
  
  // Read the array to verify
  const arrayValue = await testContract.uintArray(2);
  console.log(`uintArray[2] value: ${arrayValue}`);
  
  // 6. Set a person in personByAddress mapping
  console.log("\nSetting personByAddress for a specific address...");
  const personAddr = "0x2222222222222222222222222222222222222222";
  
  // First set the name
  await hre.stateSetter.setState({
    contractName: "TestContract",
    varName: "personByAddress",
    path: [personAddr, "name"],
    value: "Bob Johnson",
    contractAddress
  });
  
  // Then set the age
  await hre.stateSetter.setState({
    contractName: "TestContract",
    varName: "personByAddress",
    path: [personAddr, "age"],
    value: 35,
    contractAddress
  });
  
  // Read the struct in mapping to verify
  const mappingPerson = await testContract.personByAddress(personAddr);
  console.log(`personByAddress[${personAddr}].name: ${mappingPerson.name}`);
  console.log(`personByAddress[${personAddr}].age: ${mappingPerson.age}`);
  
  console.log("\nAll examples completed successfully!");
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 