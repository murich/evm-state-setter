import { ethers } from "hardhat";
import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Debugging EVM State Setter issues");
  
  // Get signers
  const [owner, user] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();
  const userAddress = await user.getAddress();
  
  // Deploy TokenVault
  const TokenVault = await ethers.getContractFactory("TokenVault");
  const tokenVault = await TokenVault.deploy("Main Vault");
  await tokenVault.waitForDeployment();
  
  const vaultAddress = await tokenVault.getAddress();
  console.log(`TokenVault deployed to: ${vaultAddress}`);
  
  // Debug case 1: struct in mapping
  try {
    console.log("Testing TokenInfo struct setting...");
    const tokenSymbol = "ETH";
    const tokenAddress = "0x1111111111111111111111111111111111111111";
    
    // First, output available storage layout info
    console.log("Available storage layout info:");
    const layoutPath = path.join(process.cwd(), 'storage-layouts', 'TokenVault.json');
    if (fs.existsSync(layoutPath)) {
      const storageLayout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
      
      // Find the supportedTokens mapping
      const supportedTokensVar = storageLayout.storage.find((v: any) => v.label === "supportedTokens");
      if (supportedTokensVar) {
        console.log("Found supportedTokens mapping:", JSON.stringify(supportedTokensVar, null, 2));
        
        // Find TokenInfo struct type info
        const tokenInfoType = supportedTokensVar.type;
        const typeInfo = storageLayout.types[tokenInfoType];
        console.log("TokenInfo mapping type info:", JSON.stringify(typeInfo, null, 2));
        
        // Try to find TokenInfo struct type
        const structType = typeInfo.value;
        const structInfo = storageLayout.types[structType];
        if (structInfo) {
          console.log("TokenInfo struct info:", JSON.stringify(structInfo, null, 2));
        } else {
          console.log("Could not find TokenInfo struct info in types");
        }
      } else {
        console.log("Could not find supportedTokens in storage layout");
      }
    } else {
      console.log("Storage layout file not found:", layoutPath);
    }
    
    // Now try to set the TokenInfo struct values
    console.log("\nAttempting to set TokenInfo struct values...");
    
    // First, let's set tokenType enum (0 = ERC20)
    await hre.stateSetter.setState({
      contractName: "TokenVault",
      contractAddress: vaultAddress,
      varName: "supportedTokens",
      path: [tokenSymbol, "tokenType"],
      value: 0 // TokenType.ERC20
    });
    console.log("Set tokenType successfully");
    
    // Set tokenName
    await hre.stateSetter.setState({
      contractName: "TokenVault",
      contractAddress: vaultAddress,
      varName: "supportedTokens",
      path: [tokenSymbol, "tokenName"],
      value: "Ethereum"
    });
    console.log("Set tokenName successfully");
    
    // Set tokenAddress
    await hre.stateSetter.setState({
      contractName: "TokenVault",
      contractAddress: vaultAddress,
      varName: "supportedTokens",
      path: [tokenSymbol, "tokenAddress"],
      value: tokenAddress
    });
    console.log("Set tokenAddress successfully");
    
    // Set decimals
    await hre.stateSetter.setState({
      contractName: "TokenVault",
      contractAddress: vaultAddress,
      varName: "supportedTokens",
      path: [tokenSymbol, "decimals"],
      value: 18
    });
    console.log("Set decimals successfully");
    
    // Set supported flag
    await hre.stateSetter.setState({
      contractName: "TokenVault",
      contractAddress: vaultAddress,
      varName: "supportedTokens",
      path: [tokenSymbol, "supported"],
      value: true
    });
    console.log("Set supported flag successfully");
    
    // Verify struct values
    const tokenInfo = await tokenVault.supportedTokens(tokenSymbol);
    console.log("TokenInfo after setting:", {
      tokenName: tokenInfo.tokenName,
      tokenAddress: tokenInfo.tokenAddress,
      tokenType: tokenInfo.tokenType,
      decimals: tokenInfo.decimals,
      supported: tokenInfo.supported
    });
  } catch (error: any) {
    console.error("Error setting TokenInfo struct:", error.message);
  }
  
  // Debug case 2: Dynamic array length
  try {
    console.log("\nTesting dynamic array length setting...");
    const symbol = "USDC";
    
    // 1. Get current length
    const lengthBefore = await tokenVault.tokenSymbols.length;
    console.log("Current tokenSymbols length:", lengthBefore);
    
    // 2. Set the new element at the current length
    console.log("Setting array element at index", lengthBefore);
    await hre.stateSetter.setArrayElement(
      "TokenVault",
      vaultAddress,
      "tokenSymbols",
      lengthBefore,
      symbol
    );
    console.log("Array element set successfully");
    
    // 3. Try to set length directly
    console.log("Attempting to set length directly");
    try {
      await hre.stateSetter.setState({
        contractName: "TokenVault",
        contractAddress: vaultAddress,
        varName: "tokenSymbols",
        path: ["length"],
        value: lengthBefore + 1
      });
      console.log("Length set successfully");
    } catch (error: any) {
      console.error("Error setting length:", error.message);
      
      // Alternative approach: implement our own length setting
      console.log("Trying alternative approach to set length...");
      // [Add alternative approach here if needed]
    }
  } catch (error: any) {
    console.error("Error with dynamic array test:", error.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 