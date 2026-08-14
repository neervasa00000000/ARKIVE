// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SecureConfig.sol";

interface IPointsSystem {
    function awardPoints(address user, uint256 amount, string calldata reason) external;
}

interface IWalletLinker {
    function getPrimary(address wallet) external view returns (address);
}

contract PostRegistry is SecureConfig {
    struct Post {
        uint256 id;
        address author;
        string arweaveId;
        string contentType;
        uint256 createdAt;
        uint256 likes;
        bool exists;
    }

    IPointsSystem public pointsSystem;
    IWalletLinker public walletLinker;

    uint256 public totalPosts;
    mapping(uint256 => Post) public posts;
    mapping(address => uint256[]) public userPostIds;
    mapping(uint256 => mapping(address => bool)) public hasLiked;

    mapping(address => uint256) public lastPostDay;
    mapping(address => uint256) public dailyPostCount;
    uint256 public constant MAX_DAILY_POSTS = 20;
    uint256 public constant MAX_ARWEAVE_ID_LEN = 64;

    event PostCreated(uint256 indexed postId, address indexed author, string arweaveId, string contentType, uint256 timestamp);
    event PostLiked(uint256 indexed postId, address indexed liker, uint256 newLikeCount);

    constructor(address _pointsSystem, address _walletLinker) {
        pointsSystem = IPointsSystem(_pointsSystem);
        walletLinker = IWalletLinker(_walletLinker);
    }

    function _resolvePrimary(address wallet) internal view returns (address) {
        if (address(walletLinker) != address(0)) {
            return walletLinker.getPrimary(wallet);
        }
        return wallet;
    }

    function createPost(string calldata arweaveId, string calldata contentType) external returns (uint256) {
        require(bytes(arweaveId).length > 0, "Arweave ID required");
        require(bytes(arweaveId).length <= MAX_ARWEAVE_ID_LEN, "Arweave ID too long");
        require(
            keccak256(bytes(contentType)) == keccak256(bytes("text")) ||
            keccak256(bytes(contentType)) == keccak256(bytes("image")),
            "Invalid content type"
        );

        address primary = _resolvePrimary(msg.sender);

        uint256 today = block.timestamp / 86400;
        if (lastPostDay[primary] != today) {
            lastPostDay[primary] = today;
            dailyPostCount[primary] = 0;
        }
        require(dailyPostCount[primary] < MAX_DAILY_POSTS, "Daily post limit reached");
        dailyPostCount[primary]++;

        uint256 postId = totalPosts++;
        posts[postId] = Post({
            id: postId,
            author: primary,
            arweaveId: arweaveId,
            contentType: contentType,
            createdAt: block.timestamp,
            likes: 0,
            exists: true
        });

        userPostIds[primary].push(postId);

        uint256 pts = keccak256(bytes(contentType)) == keccak256(bytes("image")) ? 15 : 10;
        pointsSystem.awardPoints(primary, pts, "post_created");

        emit PostCreated(postId, primary, arweaveId, contentType, block.timestamp);
        return postId;
    }

    function likePost(uint256 postId) external {
        require(posts[postId].exists, "Post not found");

        address likerPrimary = _resolvePrimary(msg.sender);
        address authorPrimary = posts[postId].author;

        require(likerPrimary != authorPrimary, "Cannot like own post");
        require(!hasLiked[postId][likerPrimary], "Already liked");

        hasLiked[postId][likerPrimary] = true;
        posts[postId].likes++;

        pointsSystem.awardPoints(authorPrimary, 2, "post_liked");

        emit PostLiked(postId, likerPrimary, posts[postId].likes);
    }

    function getPost(uint256 postId) external view returns (Post memory) {
        require(posts[postId].exists, "Post not found");
        return posts[postId];
    }

    function getUserPostIds(address wallet) external view returns (uint256[] memory) {
        return userPostIds[_resolvePrimary(wallet)];
    }

    function getRecentPosts(uint256 offset, uint256 limit) external view returns (Post[] memory) {
        uint256 total = totalPosts;
        if (offset >= total) return new Post[](0);

        uint256 end = total - offset;
        uint256 start = end > limit ? end - limit : 0;
        uint256 count = end - start;

        Post[] memory result = new Post[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = posts[start + i];
        }
        return result;
    }

    function setPointsSystem(address _ps) external onlyOwner configNotLocked {
        require(_ps != address(0), "Invalid points system");
        pointsSystem = IPointsSystem(_ps);
    }

    function setWalletLinker(address _wl) external onlyOwner configNotLocked {
        require(_wl != address(0), "Invalid linker");
        walletLinker = IWalletLinker(_wl);
    }
}
