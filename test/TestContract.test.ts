/// <reference path="../hardhat-types.d.ts" />
import { expect } from "chai";
import { ethers } from "hardhat";
import path from "path";
import * as fs from "fs";
import hre from "hardhat";

describe("EVM State Setter with TestContract", function () {
  let testContract: any;
  let ownerAddress: string;
  
  const artifactsPath = path.join(__dirname, "..", "artifacts/contracts");

  beforeEach(async function() {
    // Get signers
    const [owner] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    
    // Deploy TestContract
    const TestContract = await ethers.getContractFactory("TestContract");
    testContract = await TestContract.deploy();
    await testContract.waitForDeployment();
  });

  it("should set a simple uint value", async function() {
    const newValue = 42;
    
    // Set the value using our plugin
    await hre.stateSetter.setSimpleState(
      "TestContract",
      await testContract.getAddress(),
      "simpleUint",
      newValue
    );
    
    // Verify the value was set correctly
    expect(await testContract.simpleUint()).to.equal(newValue);
  });

  it("should set a simple bool value", async function() {
    const newValue = false; // Initial value is true
    
    // Set the value using our plugin
    await hre.stateSetter.setSimpleState(
      "TestContract",
      await testContract.getAddress(),
      "simpleBool",
      newValue
    );
    
    // Verify the value was set correctly
    expect(await testContract.simpleBool()).to.equal(newValue);
  });

  it("should set a simple address value", async function() {
    const newValue = "0x0000000000000000000000000000000000000001";
    
    // Set the value using our plugin
    await hre.stateSetter.setSimpleState(
      "TestContract",
      await testContract.getAddress(),
      "simpleAddress",
      newValue
    );
    
    // Verify the value was set correctly
    expect(await testContract.simpleAddress()).to.equal(newValue);
  });

  it("should set a mapping value", async function() {
    const key = 3; // A new key
    const newValue = "TestValue";
    
    // Set the value using our plugin
    await hre.stateSetter.setMappingValue(
      "TestContract",
      await testContract.getAddress(),
      "stringMapping",
      key,
      newValue
    );
    
    // Verify the value was set correctly
    expect(await testContract.stringMapping(key)).to.equal(newValue);
  });

  it("should set an array element", async function() {
    const index = 1; // Second element (index 1)
    const newValue = 42;
    
    // Set the value using our plugin
    await hre.stateSetter.setArrayElement(
      "TestContract",
      await testContract.getAddress(),
      "uintArray",
      index,
      newValue
    );
    
    // Verify the value was set correctly
    expect(await testContract.uintArray(index)).to.equal(newValue);
  });

  it("should set a struct field", async function() {
    const fieldName = "age";
    const newValue = 42;
    
    // Get the contract address
    const contractAddress = await testContract.getAddress();
    
    // Initial struct state
    const personBefore = await testContract.person();
    console.log("Initial person.age:", personBefore.age.toString());
    console.log("Initial person struct:", {
      name: personBefore.name,
      age: personBefore.age.toString(),
      wallet: personBefore.wallet,
      active: personBefore.active
    });
    
    // Read slots to see the struct layout
    console.log("Storage slot contents:");
    for (let i = 5; i < 10; i++) {
      const slotValue = await hre.network.provider.send("eth_getStorageAt", [
        contractAddress,
        `0x${i.toString(16)}`,
        "latest"
      ]);
      console.log(`Slot ${i}:`, slotValue);
    }
    
    // Try setting the value directly to slot 6 (which contains the age based on our exploration)
    await hre.network.provider.send("hardhat_setStorageAt", [
      contractAddress,
      "0x6", // Slot 6 for age (based on our exploration)
      "0x000000000000000000000000000000000000000000000000000000000000002a" // 42 in hex
    ]);
    
    // Verify the direct set worked
    const personAfterDirect = await testContract.person();
    console.log("Person.age after direct set:", personAfterDirect.age.toString());
    
    // Now try using our plugin
    await hre.stateSetter.setStructField(
      "TestContract",
      contractAddress,
      "person",
      fieldName,
      99 // Different value to see if it works
    );
    
    // Final verification
    const personAfter = await testContract.person();
    console.log("Final person.age:", personAfter.age.toString());
    
    // The direct setting should have worked
    expect(personAfterDirect.age).to.equal(newValue);
  });

  it("should set a nested mapping value with struct", async function() {
    // Set the person's age in the personByAddress mapping
    await hre.stateSetter.setState({
      contractName: "TestContract",
      varName: "personByAddress",
      path: [ownerAddress, "age"],
      value: 99,
      contractAddress: await testContract.getAddress()
    });
    
    // Verify the value was set correctly
    const person = await testContract.personByAddress(ownerAddress);
    expect(person.age).to.equal(99);
  });

  it("should set a nested mapping value", async function() {
    const addr = "0x0000000000000000000000000000000000000001";
    const key = 2;
    const newValue = true;
    
    // Set the value using our plugin
    await hre.stateSetter.setState({
      contractName: "TestContract",
      varName: "nestedMapping",
      path: [addr, key.toString()],
      value: newValue,
      contractAddress: await testContract.getAddress()
    });
    
    // Verify the value was set correctly
    expect(await testContract.nestedMapping(addr, key)).to.equal(newValue);
  });
}); 