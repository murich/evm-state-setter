// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Base contract with shared functionality
contract Base {
    uint256 internal baseValue;
    mapping(uint256 => bool) internal baseMapping;
    
    constructor(uint256 _initialValue) {
        baseValue = _initialValue;
        baseMapping[_initialValue] = true;
    }
    
    function getBaseValue() public view returns (uint256) {
        return baseValue;
    }
    
    function setBaseValue(uint256 _value) public virtual {
        baseValue = _value;
    }
    
    function getBaseMapping(uint256 _key) public view returns (bool) {
        return baseMapping[_key];
    }
    
    function setBaseMapping(uint256 _key, bool _value) public {
        baseMapping[_key] = _value;
    }
}

// Child contract that inherits from Base
contract Child is Base {
    struct ChildData {
        string name;
        uint256[] values;
        bool active;
    }
    
    ChildData public childData;
    mapping(address => ChildData) public dataByAddress;
    
    constructor(uint256 _baseValue, string memory _childName) Base(_baseValue) {
        childData.name = _childName;
        childData.active = true;
        childData.values.push(_baseValue);
        childData.values.push(_baseValue * 2);
    }
    
    function setChildData(string memory _name, uint256[] memory _values, bool _active) public {
        childData.name = _name;
        delete childData.values;
        for (uint256 i = 0; i < _values.length; i++) {
            childData.values.push(_values[i]);
        }
        childData.active = _active;
    }
    
    function setDataByAddress(address _addr, string memory _name, uint256[] memory _values, bool _active) public {
        ChildData storage data = dataByAddress[_addr];
        data.name = _name;
        delete data.values;
        for (uint256 i = 0; i < _values.length; i++) {
            data.values.push(_values[i]);
        }
        data.active = _active;
    }
}

// Main complex contract that inherits from Child
contract ComplexContract is Child {
    enum Status { Inactive, Active, Pending }
    
    Status public contractStatus;
    mapping(address => mapping(uint256 => Status)) public statusByAddrAndId;
    
    constructor(uint256 _baseValue, string memory _childName) Child(_baseValue, _childName) {
        contractStatus = Status.Active;
        statusByAddrAndId[msg.sender][1] = Status.Active;
    }
    
    function setContractStatus(Status _status) public {
        contractStatus = _status;
    }
    
    function setStatusByAddrAndId(address _addr, uint256 _id, Status _status) public {
        statusByAddrAndId[_addr][_id] = _status;
    }
    
    // Override parent function
    function setBaseValue(uint256 _value) public override {
        super.setBaseValue(_value);
        childData.values.push(_value);
    }
} 