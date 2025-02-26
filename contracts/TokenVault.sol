// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Base contract with access control functionality
contract AccessControl {
    // Enum for access levels
    enum AccessLevel { None, Basic, Advanced, Admin }
    
    // State variables
    address public admin;
    mapping(address => bool) public operators;
    mapping(address => AccessLevel) public userAccessLevels;
    
    // Function permissions mapping (address => function selector => allowed)
    mapping(address => mapping(bytes4 => bool)) public functionAccess;
    
    constructor() {
        admin = msg.sender;
        operators[msg.sender] = true;
        userAccessLevels[msg.sender] = AccessLevel.Admin;
    }
    
    // Modifier to restrict access to admin
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    // Modifier to restrict access to operators
    modifier onlyOperator() {
        require(operators[msg.sender], "Only operators can call this function");
        _;
    }
    
    // Functions to manage operators
    function addOperator(address _operator) external onlyAdmin {
        operators[_operator] = true;
        if (userAccessLevels[_operator] == AccessLevel.None) {
            userAccessLevels[_operator] = AccessLevel.Basic;
        }
    }
    
    function removeOperator(address _operator) external onlyAdmin {
        operators[_operator] = false;
    }
    
    // Functions to manage function access
    function setFunctionAccess(address _user, bytes4 _functionSig, bool _hasAccess) external onlyAdmin {
        functionAccess[_user][_functionSig] = _hasAccess;
    }
    
    // Function to set user access level
    function setUserAccessLevel(address _user, AccessLevel _level) external onlyAdmin {
        userAccessLevels[_user] = _level;
    }
}

// Main TokenVault contract that inherits from AccessControl
contract TokenVault is AccessControl {
    // Enums for token types
    enum TokenType { ERC20, ERC721, ERC1155 }
    
    // Struct for token information
    struct TokenInfo {
        string tokenName;
        address tokenAddress;
        TokenType tokenType;
        uint8 decimals;
        bool supported;
    }
    
    // Struct for user positions
    struct UserPosition {
        uint256 depositAmount;
        uint256 depositTimestamp;
        bool locked;
        // Nested mapping: tokenId => amount (useful for NFTs)
        mapping(uint256 => uint256) tokenAmounts;
    }
    
    // State variables
    string public name;
    bool public paused;
    uint256 public totalTokensStored;
    
    // Fixed-size array
    address[5] public topUsers;
    
    // Dynamic array
    string[] public tokenSymbols;
    
    // Mappings
    mapping(string => TokenInfo) public supportedTokens;
    mapping(uint256 => address[5]) public projectContributors;
    
    // Complex nested mappings
    mapping(address => mapping(uint256 => mapping(string => uint256))) public userTokenBalanceByProject;
    
    // Mapping to struct with internal mapping
    mapping(address => mapping(string => UserPosition)) public userPositions;
    
    // Events
    event TokenAdded(string symbol, address tokenAddress);
    event PositionUpdated(address indexed user, string symbol, uint256 amount);
    event Deposit(address indexed user, string symbol, uint256 amount);
    event Withdrawal(address indexed user, string symbol, uint256 amount);
    
    constructor(string memory _name) {
        name = _name;
        paused = false;
        totalTokensStored = 0;
    }
    
    // Function to add a token
    function addToken(
        string calldata _symbol,
        string calldata _name,
        address _tokenAddress,
        TokenType _type,
        uint8 _decimals
    ) external onlyAdmin {
        supportedTokens[_symbol] = TokenInfo({
            tokenName: _name,
            tokenAddress: _tokenAddress,
            tokenType: _type,
            decimals: _decimals,
            supported: true
        });
        
        tokenSymbols.push(_symbol);
        emit TokenAdded(_symbol, _tokenAddress);
    }
    
    // Function to update project contributors
    function setProjectContributor(uint256 _projectId, uint256 _index, address _contributor) 
        external onlyOperator {
        require(_index < 5, "Index out of bounds");
        projectContributors[_projectId][_index] = _contributor;
    }
    
    // Function to set top users
    function setTopUser(uint256 _index, address _user) external onlyOperator {
        require(_index < 5, "Index out of bounds");
        topUsers[_index] = _user;
    }
    
    // Function to update user token balance
    function updateUserTokenBalance(address _user, uint256 _projectId, string calldata _symbol, uint256 _balance) 
        external onlyOperator {
        userTokenBalanceByProject[_user][_projectId][_symbol] = _balance;
    }
    
    // Function to deposit tokens
    function deposit(string calldata _symbol, uint256 _amount) external {
        require(!paused, "Contract is paused");
        require(supportedTokens[_symbol].supported, "Token not supported");
        
        userPositions[msg.sender][_symbol].depositAmount += _amount;
        userPositions[msg.sender][_symbol].depositTimestamp = block.timestamp;
        
        totalTokensStored += _amount;
        emit Deposit(msg.sender, _symbol, _amount);
    }
    
    // Function to record NFT deposit
    function depositNFT(string calldata _symbol, uint256 _tokenId, uint256 _amount) external {
        require(!paused, "Contract is paused");
        require(supportedTokens[_symbol].supported, "Token not supported");
        require(
            supportedTokens[_symbol].tokenType == TokenType.ERC721 || 
            supportedTokens[_symbol].tokenType == TokenType.ERC1155, 
            "Not an NFT token"
        );
        
        userPositions[msg.sender][_symbol].tokenAmounts[_tokenId] += _amount;
        emit PositionUpdated(msg.sender, _symbol, _amount);
    }
    
    // Function to withdraw tokens
    function withdraw(string calldata _symbol, uint256 _amount) external {
        require(!paused, "Contract is paused");
        require(!userPositions[msg.sender][_symbol].locked, "Position is locked");
        require(userPositions[msg.sender][_symbol].depositAmount >= _amount, "Insufficient balance");
        
        userPositions[msg.sender][_symbol].depositAmount -= _amount;
        
        totalTokensStored -= _amount;
        emit Withdrawal(msg.sender, _symbol, _amount);
    }
    
    // Function to lock a position
    function lockPosition(string calldata _symbol) external {
        userPositions[msg.sender][_symbol].locked = true;
    }
    
    // Function to unlock a position (admin only)
    function unlockPosition(address _user, string calldata _symbol) external onlyAdmin {
        userPositions[_user][_symbol].locked = false;
    }
    
    // Function to pause/unpause the contract
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
    }
} 