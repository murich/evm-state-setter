# Testing the hardhat-evm-state-setter Plugin

This document describes the test coverage implemented for the hardhat-evm-state-setter plugin and outlines what we've learned about its capabilities.

## Test Coverage

The test suite includes tests for:

### Basic Contract State (TestContract):
- Setting simple variables (uint, string, bool, address)
- Setting mapping values (address => uint)
- Setting struct fields in mappings
- Setting complex nested paths

### Complex Contract State (TokenVault):
- Setting simple state variables
- Setting inherited state variables from parent contracts
- Setting enum values
- Setting values in multi-level mappings
- Setting fixed-size array elements
- Setting values in fixed-size arrays within mappings
- Setting nested function permissions in parent contracts

## Current Limitations

During testing, we identified some current limitations:

1. **Struct Member Information**: The plugin requires complete struct member information to be available in the storage layout. For complex structs, especially those with internal mappings, there might be limitations in how the storage layout is extracted or interpreted.

2. **Dynamic Arrays**: Manipulating dynamic array lengths directly is challenging. While you can modify existing array elements using `setArrayElement`, directly changing the array length is not supported.

3. **Complex Nested Structures**: For structures that have mappings inside structs, the plugin may face challenges due to how Solidity stores these complex data types at the EVM level.

## Best Practices

Based on our testing, we recommend the following best practices when using the plugin:

1. **Storage Layout Information**: Ensure that storage layout information is properly extracted and available before attempting to set state variables.

2. **Contract Name Matching**: Verify that contract names used in state setter functions match exactly with the artifact names, paying special attention to inherited contracts.

3. **Simple to Complex Approach**: When testing, start with simple variables and progressively move to more complex data structures.

4. **Fallback to Contract Functions**: For very complex data structures or operations not yet supported by the plugin, consider using contract functions to set up the initial state, then use the plugin for subsequent modifications.

5. **Path Resolution**: For complex paths (like mappings within structs), ensure that you understand the storage path format used by the plugin.

## Future Enhancements

Potential areas for improvement in the plugin:

1. Enhanced support for struct manipulation, especially for structs with internal mappings.
2. Better handling of dynamic arrays, including the ability to manipulate array length.
3. Improved error reporting for unsupported operations.
4. Documentation on how storage paths are resolved for complex data structures.

## Conclusion

The hardhat-evm-state-setter plugin provides powerful capabilities for directly manipulating EVM state without requiring transaction execution. While it has some limitations with very complex data structures, it successfully handles most common Solidity patterns and significantly improves the testing experience by allowing direct state manipulation. 