// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Two-step ownership transfer + one-way config lock for registry contracts.
abstract contract SecureConfig {
    address public owner;
    address public pendingOwner;
    bool public configLocked;

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ConfigLocked();

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier configNotLocked() {
        require(!configLocked, "Config locked");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address oldOwner = owner;
        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, owner);
    }

    /// @dev Irreversible — prevents swapping WalletLinker / PointsSystem after deployment wiring.
    function lockConfig() external onlyOwner {
        configLocked = true;
        emit ConfigLocked();
    }
}
