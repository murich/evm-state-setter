import fs from 'fs';
import path from 'path';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

// Make sure to run this script with `hardhat run scripts/print-storage-layout.ts`
async function main() {
  const hre = require('hardhat') as HardhatRuntimeEnvironment;
  
  // You can specify the contract name here
  const contractName = 'TestContract';
  
  // Compile if needed (this ensures storageLayout is generated)
  await hre.run('compile');
  
  // Get the storage layout
  const artifactPath = path.join(
    hre.config.paths.artifacts,
    'contracts',
    `${contractName}.sol`,
    `${contractName}.json`
  );
  
  if (!fs.existsSync(artifactPath)) {
    console.error(`Artifact not found for ${contractName}`);
    return;
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  if (!artifact.storageLayout) {
    console.error(`No storage layout found in artifact for ${contractName}`);
    console.error('Make sure you have the hardhat-storage-layout plugin enabled');
    return;
  }
  
  console.log(`\n=== Storage Layout for ${contractName} ===\n`);
  
  // Print the storage variables
  console.log('STORAGE VARIABLES:');
  console.log('------------------');
  
  const { storage, types } = artifact.storageLayout;
  
  storage.forEach((item: any) => {
    const typeInfo = types[item.type];
    console.log(`${item.label} (${item.type}):`);
    console.log(`  Slot: ${item.slot}`);
    console.log(`  Offset: ${item.offset}`);
    console.log(`  Bytes: ${typeInfo?.numberOfBytes || 'unknown'}`);
    
    // Print additional information for complex types
    if (typeInfo?.members) {
      console.log('  Members:');
      typeInfo.members.forEach((member: any) => {
        console.log(`    ${member.label} (${member.type}):`);
        console.log(`      Slot Offset: ${member.slot}`);
        console.log(`      Member Offset: ${member.offset}`);
      });
    }
    
    console.log('');
  });
  
  // Print the types
  console.log('\nTYPES:');
  console.log('------');
  
  Object.entries(types).forEach(([typeName, typeInfo]: [string, any]) => {
    console.log(`${typeName}:`);
    console.log(`  Encoding: ${typeInfo.encoding}`);
    console.log(`  Label: ${typeInfo.label}`);
    console.log(`  Bytes: ${typeInfo.numberOfBytes}`);
    
    if (typeInfo.members) {
      console.log('  Members:');
      typeInfo.members.forEach((member: any) => {
        console.log(`    ${member.label} (${member.type}) @ offset ${member.offset}`);
      });
    }
    
    if (typeInfo.key) {
      console.log(`  Key Type: ${typeInfo.key}`);
    }
    
    if (typeInfo.value) {
      console.log(`  Value Type: ${typeInfo.value}`);
    }
    
    console.log('');
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 