// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SecureConfig.sol";

interface IWalletLinker {
    function getPrimary(address wallet) external view returns (address);
    function areSameIdentity(address w1, address w2) external view returns (bool);
}

contract VaultRegistry is SecureConfig {
    struct VaultFile {
        uint256 id;
        address owner;
        string encryptedArweaveId;
        string fileName;
        string fileType;
        string litConditionsHash;
        uint256 storedAt;
        bool exists;
        bool isDeleted;
    }

    IWalletLinker public walletLinker;

    uint256 public constant MAX_ARWEAVE_ID_LEN = 64;
    uint256 public constant MAX_FILE_NAME_LEN = 200;
    uint256 public constant MAX_FILE_TYPE_LEN = 32;
    uint256 public constant MAX_CONDITIONS_HASH_LEN = 128;
    uint256 public constant MAX_FILES_PER_USER = 500;
    uint256 public constant MAX_DAILY_STORES = 100;

    uint256 public totalFiles;
    mapping(uint256 => VaultFile) private files;
    mapping(address => uint256[]) private userFileIds;
    mapping(address => uint256) public lastStoreDay;
    mapping(address => uint256) public dailyStoreCount;
    mapping(bytes32 => bool) private storedArweaveHashes;

    event FileStored(uint256 indexed fileId, address indexed owner, string fileName, uint256 timestamp);
    event FileDeleted(uint256 indexed fileId, address indexed owner);

    constructor(address _walletLinker) {
        walletLinker = IWalletLinker(_walletLinker);
    }

    function _resolvePrimary(address wallet) internal view returns (address) {
        if (address(walletLinker) != address(0)) {
            return walletLinker.getPrimary(wallet);
        }
        return wallet;
    }

    function _isSameIdentity(address w1, address w2) internal view returns (bool) {
        if (w1 == w2) return true;
        if (address(walletLinker) != address(0)) {
            return walletLinker.areSameIdentity(w1, w2);
        }
        return false;
    }

    function _checkStoreRateLimit(address primary) internal {
        uint256 day = block.timestamp / 1 days;
        if (lastStoreDay[primary] != day) {
            lastStoreDay[primary] = day;
            dailyStoreCount[primary] = 0;
        }
        require(dailyStoreCount[primary] < MAX_DAILY_STORES, "Daily store limit reached");
        dailyStoreCount[primary]++;
    }

    function storeFile(
        string calldata encryptedArweaveId,
        string calldata fileName,
        string calldata fileType,
        string calldata litConditionsHash
    ) external returns (uint256) {
        require(bytes(encryptedArweaveId).length > 0, "Arweave ID required");
        require(bytes(encryptedArweaveId).length <= MAX_ARWEAVE_ID_LEN, "Arweave ID too long");
        require(bytes(fileName).length > 0, "File name required");
        require(bytes(fileName).length <= MAX_FILE_NAME_LEN, "File name too long");
        require(bytes(fileType).length > 0 && bytes(fileType).length <= MAX_FILE_TYPE_LEN, "Invalid file type");
        require(bytes(litConditionsHash).length <= MAX_CONDITIONS_HASH_LEN, "Conditions hash too long");
        require(
            keccak256(bytes(fileType)) == keccak256(bytes("image")) ||
            keccak256(bytes(fileType)) == keccak256(bytes("document")) ||
            keccak256(bytes(fileType)) == keccak256(bytes("video")) ||
            keccak256(bytes(fileType)) == keccak256(bytes("other")),
            "Invalid file type"
        );

        bytes32 arweaveHash = keccak256(bytes(encryptedArweaveId));
        require(!storedArweaveHashes[arweaveHash], "Arweave ID already stored");
        storedArweaveHashes[arweaveHash] = true;

        address primary = _resolvePrimary(msg.sender);
        require(userFileIds[primary].length < MAX_FILES_PER_USER, "File limit reached");
        _checkStoreRateLimit(primary);

        uint256 fileId = totalFiles++;
        files[fileId] = VaultFile({
            id: fileId,
            owner: primary,
            encryptedArweaveId: encryptedArweaveId,
            fileName: fileName,
            fileType: fileType,
            litConditionsHash: litConditionsHash,
            storedAt: block.timestamp,
            exists: true,
            isDeleted: false
        });

        userFileIds[primary].push(fileId);

        emit FileStored(fileId, primary, fileName, block.timestamp);
        return fileId;
    }

    function getMyFiles() external view returns (VaultFile[] memory) {
        address primary = _resolvePrimary(msg.sender);
        uint256[] memory ids = userFileIds[primary];
        uint256 count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            if (!files[ids[i]].isDeleted) count++;
        }

        VaultFile[] memory result = new VaultFile[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (!files[ids[i]].isDeleted) {
                result[j++] = files[ids[i]];
            }
        }
        return result;
    }

    function getFile(uint256 fileId) external view returns (VaultFile memory) {
        require(files[fileId].exists, "File not found");
        require(_isSameIdentity(msg.sender, files[fileId].owner), "Not authorised to access this file");
        return files[fileId];
    }

    function deleteFile(uint256 fileId) external {
        require(files[fileId].exists, "File not found");
        require(_isSameIdentity(msg.sender, files[fileId].owner), "Not authorised to delete this file");
        files[fileId].isDeleted = true;
        emit FileDeleted(fileId, msg.sender);
    }

    function getMyFileCount() external view returns (uint256) {
        return userFileIds[_resolvePrimary(msg.sender)].length;
    }

    function setWalletLinker(address _wl) external onlyOwner configNotLocked {
        require(_wl != address(0), "Invalid linker");
        walletLinker = IWalletLinker(_wl);
    }
}
