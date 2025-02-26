// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestContract {
    // Simple types
    uint256 public simpleUint;
    bool public simpleBool;
    address public simpleAddress;
    string public simpleString;
    
    // Arrays
    uint256[] public uintArray;
    mapping(uint256 => string) public stringMapping;
    
    // Complex struct
    struct Person {
        string name;
        uint256 age;
        address wallet;
        bool active;
    }
    
    Person public person;
    mapping(address => Person) public personByAddress;
    Person[] public people;
    
    // Nested mappings
    mapping(address => mapping(uint256 => bool)) public nestedMapping;
    
    constructor() {
        simpleUint = 100;
        simpleBool = true;
        simpleAddress = address(0x1234567890123456789012345678901234567890);
        simpleString = "Hello, World!";
        
        uintArray.push(1);
        uintArray.push(2);
        uintArray.push(3);
        
        stringMapping[1] = "One";
        stringMapping[2] = "Two";
        
        person = Person({
            name: "John Doe",
            age: 30,
            wallet: address(0x9876543210987654321098765432109876543210),
            active: true
        });
        
        personByAddress[msg.sender] = Person({
            name: "Contract Owner",
            age: 25,
            wallet: msg.sender,
            active: true
        });
        
        people.push(Person({
            name: "Alice",
            age: 28,
            wallet: address(0x1111111111111111111111111111111111111111),
            active: true
        }));
        
        nestedMapping[msg.sender][1] = true;
    }
    
    // Functions to set values
    function setSimpleUint(uint256 _value) public {
        simpleUint = _value;
    }
    
    function setSimpleBool(bool _value) public {
        simpleBool = _value;
    }
    
    function setSimpleAddress(address _value) public {
        simpleAddress = _value;
    }
    
    function setSimpleString(string memory _value) public {
        simpleString = _value;
    }
    
    function setPerson(string memory _name, uint256 _age, address _wallet, bool _active) public {
        person = Person({
            name: _name,
            age: _age,
            wallet: _wallet,
            active: _active
        });
    }
    
    function addToUintArray(uint256 _value) public {
        uintArray.push(_value);
    }
    
    function setStringMapping(uint256 _key, string memory _value) public {
        stringMapping[_key] = _value;
    }
    
    function addPerson(string memory _name, uint256 _age, address _wallet, bool _active) public {
        people.push(Person({
            name: _name,
            age: _age,
            wallet: _wallet,
            active: _active
        }));
    }
    
    function setPersonByAddress(address _addr, string memory _name, uint256 _age, address _wallet, bool _active) public {
        personByAddress[_addr] = Person({
            name: _name,
            age: _age,
            wallet: _wallet,
            active: _active
        });
    }
    
    function setNestedMapping(address _addr, uint256 _key, bool _value) public {
        nestedMapping[_addr][_key] = _value;
    }
} 