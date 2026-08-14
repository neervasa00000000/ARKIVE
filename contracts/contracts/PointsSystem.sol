// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SecureConfig.sol";

interface IWalletLinker {
    function getPrimary(address wallet) external view returns (address);
}

contract PointsSystem is SecureConfig {
    IWalletLinker public walletLinker;

    mapping(address => uint256) public points;
    mapping(address => uint256) public totalEarned;

    mapping(address => uint256) public lastEarnDay;
    mapping(address => uint256) public dailyEarned;
    uint256 public constant MAX_DAILY_EARN = 500;

    mapping(address => bool) public authorisedCallers;
    mapping(address => bool) public welcomeBonusClaimed;

    bool private _locked;

    event PointsAwarded(address indexed user, uint256 amount, string reason, uint256 newBalance);
    event PointsSpent(address indexed user, uint256 amount, string reason, uint256 newBalance);

    modifier onlyAuthorised() {
        require(authorisedCallers[msg.sender] || msg.sender == owner, "Not authorised");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }

    constructor() {
        authorisedCallers[msg.sender] = true;
    }

    function setWalletLinker(address _wl) external onlyOwner configNotLocked {
        require(_wl != address(0), "Invalid linker");
        walletLinker = IWalletLinker(_wl);
    }

    function authoriseCaller(address caller) external onlyOwner {
        authorisedCallers[caller] = true;
    }

    function revokeCaller(address caller) external onlyOwner {
        require(caller != owner, "Cannot revoke owner");
        authorisedCallers[caller] = false;
    }

    function _resolvePrimary(address wallet) internal view returns (address) {
        if (address(walletLinker) != address(0)) {
            return walletLinker.getPrimary(wallet);
        }
        return wallet;
    }

    function awardPoints(address user, uint256 amount, string calldata reason) external onlyAuthorised nonReentrant {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Invalid amount");

        address primary = _resolvePrimary(user);

        uint256 today = block.timestamp / 86400;
        if (lastEarnDay[primary] != today) {
            lastEarnDay[primary] = today;
            dailyEarned[primary] = 0;
        }

        uint256 remaining = MAX_DAILY_EARN > dailyEarned[primary]
            ? MAX_DAILY_EARN - dailyEarned[primary]
            : 0;
        uint256 actual = amount > remaining ? remaining : amount;

        if (actual > 0) {
            points[primary] += actual;
            totalEarned[primary] += actual;
            dailyEarned[primary] += actual;
            emit PointsAwarded(primary, actual, reason, points[primary]);
        }
    }

    function spendPoints(address user, uint256 amount, string calldata reason) external onlyAuthorised nonReentrant {
        address primary = _resolvePrimary(user);
        require(amount > 0, "Invalid amount");
        require(points[primary] >= amount, "Insufficient points");
        points[primary] -= amount;
        emit PointsSpent(primary, amount, reason, points[primary]);
    }

    function claimWelcomeBonus() external nonReentrant {
        address primary = _resolvePrimary(msg.sender);
        require(!welcomeBonusClaimed[primary], "Welcome bonus already claimed");

        uint256 today = block.timestamp / 86400;
        if (lastEarnDay[primary] != today) {
            lastEarnDay[primary] = today;
            dailyEarned[primary] = 0;
        }

        uint256 bonus = 225;
        uint256 remaining = MAX_DAILY_EARN > dailyEarned[primary]
            ? MAX_DAILY_EARN - dailyEarned[primary]
            : 0;
        uint256 actual = bonus > remaining ? remaining : bonus;
        require(actual > 0, "Daily cap reached");

        welcomeBonusClaimed[primary] = true;
        points[primary] += actual;
        totalEarned[primary] += actual;
        dailyEarned[primary] += actual;
        emit PointsAwarded(primary, actual, "welcome_bonus", points[primary]);
    }

    function getPoints(address user) external view returns (uint256) {
        return points[_resolvePrimary(user)];
    }

    function getDailyEarned(address user) external view returns (uint256) {
        address primary = _resolvePrimary(user);
        uint256 today = block.timestamp / 86400;
        if (lastEarnDay[primary] != today) return 0;
        return dailyEarned[primary];
    }

    function isBonusClaimed(address user) external view returns (bool) {
        return welcomeBonusClaimed[_resolvePrimary(user)];
    }
}
