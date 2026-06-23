// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PointsSystem {
    mapping(address => uint256) public points;
    mapping(address => uint256) public totalEarned;

    // Daily earning caps
    mapping(address => uint256) public lastEarnDay;
    mapping(address => uint256) public dailyEarned;
    uint256 public constant MAX_DAILY_EARN = 500;

    address public owner;
    mapping(address => bool) public authorisedCallers; // PostRegistry gets authorised

    event PointsAwarded(address indexed user, uint256 amount, string reason, uint256 newBalance);
    event PointsSpent(address indexed user, uint256 amount, string reason, uint256 newBalance);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAuthorised() {
        require(authorisedCallers[msg.sender] || msg.sender == owner, "Not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorisedCallers[msg.sender] = true;
    }

    function authoriseCaller(address caller) external onlyOwner {
        authorisedCallers[caller] = true;
    }

    function awardPoints(address user, uint256 amount, string calldata reason) external onlyAuthorised {
        // Daily cap check
        uint256 today = block.timestamp / 86400;
        if (lastEarnDay[user] != today) {
            lastEarnDay[user] = today;
            dailyEarned[user] = 0;
        }

        uint256 remaining = MAX_DAILY_EARN > dailyEarned[user] ? MAX_DAILY_EARN - dailyEarned[user] : 0;
        uint256 actualAmount = amount > remaining ? remaining : amount;

        if (actualAmount > 0) {
            points[user] += actualAmount;
            totalEarned[user] += actualAmount;
            dailyEarned[user] += actualAmount;
            emit PointsAwarded(user, actualAmount, reason, points[user]);
        }
    }

    function spendPoints(address user, uint256 amount, string calldata reason) external onlyAuthorised {
        require(points[user] >= amount, "Insufficient points");
        points[user] -= amount;
        emit PointsSpent(user, amount, reason, points[user]);
    }

    // Welcome bonus for new users
    function claimWelcomeBonus() external {
        require(totalEarned[msg.sender] == 0, "Already claimed");
        points[msg.sender] += 225;
        totalEarned[msg.sender] += 225;
        emit PointsAwarded(msg.sender, 225, "welcome_bonus", points[msg.sender]);
    }

    function getPoints(address user) external view returns (uint256) {
        return points[user];
    }

    function getDailyEarned(address user) external view returns (uint256) {
        uint256 today = block.timestamp / 86400;
        if (lastEarnDay[user] != today) return 0;
        return dailyEarned[user];
    }
}
