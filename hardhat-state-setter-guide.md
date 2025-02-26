# Guide: Using hardhat-evm-state-setter with hardhat-deploy

## Setup
* Install packages: `hardhat-deploy`, `hardhat-evm-state-setter`, `hardhat-storage-layout`
* Configure `hardhat.config.ts`:
  * Import all three plugins
  * Enable `outputSelection` for `storageLayout`
  * Add `stateSetterConfig` with artifact and storage layout paths
  * Configure `namedAccounts` for deployment roles
* Extract storage layouts after compilation

## Testing Workflow
* Deploy with hardhat-deploy scripts in the `deploy` folder
* Access deployed contracts in tests using `deployments.fixture()`
* Use state-setter to manipulate contract state directly:
  * `setSimpleState` for basic variables
  * `setMappingValue` for mapping entries
  * `setArrayElement` for array elements
  * `setState` for complex paths

## Best Practices
* Organize deployment scripts with numbered prefixes and tags
* Create reusable test fixtures for common scenarios
* Document storage layout assumptions in tests
* Use state-setter for cases that are difficult to set up with transactions
* Initialize contracts once via deployment, then modify state for edge cases

## Common Testing Patterns
* Set extreme values (e.g., maximum balances)
* Initialize multiple interacting contracts to specific states
* Create complex prerequisite conditions (e.g., liquidation scenarios)
* Test inheritance by setting state in parent contracts

## Troubleshooting
* Verify storage layouts are properly extracted
* Ensure contract names match exactly with artifacts
* For structs with mappings, use contract functions when direct state setting fails
* Confirm the network allows state modifications (`hardhat_setStorageAt`)

## Structure for Rewriting Tests
1. Identify current setup code that initializes contracts
2. Replace with `deployments.fixture()`
3. Replace contract function calls that set up state with direct state manipulation
4. Keep test assertions the same
5. Document which storage slots/paths are being manipulated

Remember: Direct state manipulation should target testing edge cases that would be complex to set up with normal contract interactions. 