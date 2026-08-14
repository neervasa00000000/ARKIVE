// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SecureConfig.sol";

interface IWalletLinker {
    function getPrimary(address wallet) external view returns (address);
}

contract UserRegistry is SecureConfig {
    struct User {
        string username;
        string profileArweaveId;
        uint256 joinedAt;
        bool exists;
    }

    IWalletLinker public walletLinker;

    mapping(address => User) public users;
    mapping(string => address) public usernameToAddress;
    address[] public allUsers;

    uint256 public constant MAX_USERNAME_LEN = 32;
    uint256 public constant MIN_USERNAME_LEN = 3;
    uint256 public constant MAX_ARWEAVE_ID_LEN = 64;

    event UserRegistered(address indexed wallet, string username, uint256 timestamp);
    event ProfileUpdated(address indexed wallet, string profileArweaveId);

    function setWalletLinker(address _linker) external onlyOwner configNotLocked {
        require(_linker != address(0), "Invalid linker");
        walletLinker = IWalletLinker(_linker);
    }

    function _resolvePrimary(address wallet) internal view returns (address) {
        if (address(walletLinker) != address(0)) {
            return walletLinker.getPrimary(wallet);
        }
        return wallet;
    }

    function register(string calldata username) external {
        address primary = _resolvePrimary(msg.sender);
        require(!users[primary].exists, "Already registered");
        require(_isValidUsername(username), "Invalid username");
        require(usernameToAddress[username] == address(0), "Username taken");

        users[primary] = User({
            username: username,
            profileArweaveId: "",
            joinedAt: block.timestamp,
            exists: true
        });

        usernameToAddress[username] = primary;
        allUsers.push(primary);

        emit UserRegistered(primary, username, block.timestamp);
    }

    function updateProfile(string calldata profileArweaveId) external {
        address primary = _resolvePrimary(msg.sender);
        require(users[primary].exists, "Not registered");
        require(bytes(profileArweaveId).length <= MAX_ARWEAVE_ID_LEN, "Arweave ID too long");
        users[primary].profileArweaveId = profileArweaveId;
        emit ProfileUpdated(primary, profileArweaveId);
    }

    function getUser(address wallet) external view returns (User memory) {
        return users[_resolvePrimary(wallet)];
    }

    function isRegistered(address wallet) external view returns (bool) {
        return users[_resolvePrimary(wallet)].exists;
    }

    function getTotalUsers() external view returns (uint256) {
        return allUsers.length;
    }

    function _isValidUsername(string calldata username) internal pure returns (bool) {
        bytes memory b = bytes(username);
        if (b.length < MIN_USERNAME_LEN || b.length > MAX_USERNAME_LEN) return false;

        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool isLower = c >= 0x61 && c <= 0x7A;
            bool isDigit = c >= 0x30 && c <= 0x39;
            bool isUnderscore = c == 0x5F;
            if (!(isLower || isDigit || isUnderscore)) {
                return false;
            }
        }
        return true;
    }
}
