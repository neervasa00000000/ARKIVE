// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UserRegistry {
    struct User {
        string username;
        string profileArweaveId;  // profile picture stored on Arweave
        uint256 joinedAt;
        bool exists;
    }

    mapping(address => User) public users;
    mapping(string => address) public usernameToAddress;
    address[] public allUsers;

    event UserRegistered(address indexed wallet, string username, uint256 timestamp);
    event ProfileUpdated(address indexed wallet, string profileArweaveId);

    modifier onlyRegistered() {
        require(users[msg.sender].exists, "Not registered");
        _;
    }

    function register(string calldata username) external {
        require(!users[msg.sender].exists, "Already registered");
        require(bytes(username).length >= 3 && bytes(username).length <= 32, "Username 3-32 chars");
        require(usernameToAddress[username] == address(0), "Username taken");

        users[msg.sender] = User({
            username: username,
            profileArweaveId: "",
            joinedAt: block.timestamp,
            exists: true
        });

        usernameToAddress[username] = msg.sender;
        allUsers.push(msg.sender);

        emit UserRegistered(msg.sender, username, block.timestamp);
    }

    function updateProfile(string calldata profileArweaveId) external onlyRegistered {
        users[msg.sender].profileArweaveId = profileArweaveId;
        emit ProfileUpdated(msg.sender, profileArweaveId);
    }

    function getUser(address wallet) external view returns (User memory) {
        return users[wallet];
    }

    function isRegistered(address wallet) external view returns (bool) {
        return users[wallet].exists;
    }

    function getTotalUsers() external view returns (uint256) {
        return allUsers.length;
    }
}
