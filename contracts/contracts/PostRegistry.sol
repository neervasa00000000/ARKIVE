// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPointsSystem {
    function awardPoints(address user, uint256 amount, string calldata reason) external;
}

contract PostRegistry {
    struct Post {
        uint256 id;
        address author;
        string arweaveId;        // content stored on Arweave
        string contentType;      // "text" or "image"
        uint256 createdAt;
        uint256 likes;
        bool exists;
    }

    IPointsSystem public pointsSystem;
    address public owner;

    uint256 public totalPosts;
    mapping(uint256 => Post) public posts;
    mapping(address => uint256[]) public userPostIds;
    mapping(uint256 => mapping(address => bool)) public hasLiked;

    // Daily post limit per user
    mapping(address => uint256) public lastPostDay;
    mapping(address => uint256) public dailyPostCount;
    uint256 public constant MAX_DAILY_POSTS = 20;

    event PostCreated(uint256 indexed postId, address indexed author, string arweaveId, string contentType, uint256 timestamp);
    event PostLiked(uint256 indexed postId, address indexed liker, uint256 newLikeCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _pointsSystem) {
        owner = msg.sender;
        pointsSystem = IPointsSystem(_pointsSystem);
    }

    function createPost(string calldata arweaveId, string calldata contentType) external returns (uint256) {
        require(bytes(arweaveId).length > 0, "Arweave ID required");
        require(
            keccak256(bytes(contentType)) == keccak256(bytes("text")) ||
            keccak256(bytes(contentType)) == keccak256(bytes("image")),
            "Invalid content type"
        );

        // Daily post limit
        uint256 today = block.timestamp / 86400;
        if (lastPostDay[msg.sender] != today) {
            lastPostDay[msg.sender] = today;
            dailyPostCount[msg.sender] = 0;
        }
        require(dailyPostCount[msg.sender] < MAX_DAILY_POSTS, "Daily post limit reached");
        dailyPostCount[msg.sender]++;

        uint256 postId = totalPosts++;
        posts[postId] = Post({
            id: postId,
            author: msg.sender,
            arweaveId: arweaveId,
            contentType: contentType,
            createdAt: block.timestamp,
            likes: 0,
            exists: true
        });

        userPostIds[msg.sender].push(postId);

        // Award points for posting
        uint256 points = keccak256(bytes(contentType)) == keccak256(bytes("image")) ? 15 : 10;
        try pointsSystem.awardPoints(msg.sender, points, "post_created") {} catch {}

        emit PostCreated(postId, msg.sender, arweaveId, contentType, block.timestamp);
        return postId;
    }

    function likePost(uint256 postId) external {
        require(posts[postId].exists, "Post not found");
        require(!hasLiked[postId][msg.sender], "Already liked");
        require(posts[postId].author != msg.sender, "Cannot like own post");

        hasLiked[postId][msg.sender] = true;
        posts[postId].likes++;

        // Award points to post author for receiving a like
        try pointsSystem.awardPoints(posts[postId].author, 2, "post_liked") {} catch {}

        emit PostLiked(postId, msg.sender, posts[postId].likes);
    }

    function getPost(uint256 postId) external view returns (Post memory) {
        require(posts[postId].exists, "Post not found");
        return posts[postId];
    }

    function getUserPostIds(address user) external view returns (uint256[] memory) {
        return userPostIds[user];
    }

    // Get paginated posts for feed (most recent first)
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

    function setPointsSystem(address _pointsSystem) external onlyOwner {
        pointsSystem = IPointsSystem(_pointsSystem);
    }
}
