// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VaultRegistry {
    struct VaultFile {
        uint256 id;
        address owner;
        string encryptedArweaveId;    // encrypted content on Arweave
        string fileName;               // original file name (not encrypted, just for display)
        string fileType;               // "image", "document", "video", "other"
        string litConditionsHash;      // hash of Lit Protocol access conditions
        uint256 storedAt;
        bool exists;
        bool isDeleted;                // soft delete only — Arweave is permanent
    }

    uint256 public totalFiles;
    mapping(uint256 => VaultFile) private files;
    mapping(address => uint256[]) private userFileIds;

    event FileStored(uint256 indexed fileId, address indexed owner, string fileName, uint256 timestamp);
    event FileDeleted(uint256 indexed fileId, address indexed owner);

    modifier onlyFileOwner(uint256 fileId) {
        require(files[fileId].exists, "File not found");
        require(files[fileId].owner == msg.sender, "Not file owner");
        _;
    }

    function storeFile(
        string calldata encryptedArweaveId,
        string calldata fileName,
        string calldata fileType,
        string calldata litConditionsHash
    ) external returns (uint256) {
        require(bytes(encryptedArweaveId).length > 0, "Arweave ID required");
        require(bytes(fileName).length > 0, "File name required");

        uint256 fileId = totalFiles++;
        files[fileId] = VaultFile({
            id: fileId,
            owner: msg.sender,
            encryptedArweaveId: encryptedArweaveId,
            fileName: fileName,
            fileType: fileType,
            litConditionsHash: litConditionsHash,
            storedAt: block.timestamp,
            exists: true,
            isDeleted: false
        });

        userFileIds[msg.sender].push(fileId);

        emit FileStored(fileId, msg.sender, fileName, block.timestamp);
        return fileId;
    }

    // CRITICAL: Only returns files owned by msg.sender
    function getMyFiles() external view returns (VaultFile[] memory) {
        uint256[] memory ids = userFileIds[msg.sender];
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

    // Only owner can get file details
    function getFile(uint256 fileId) external view onlyFileOwner(fileId) returns (VaultFile memory) {
        return files[fileId];
    }

    // Soft delete — marks as deleted in registry but Arweave is immutable
    function deleteFile(uint256 fileId) external onlyFileOwner(fileId) {
        files[fileId].isDeleted = true;
        emit FileDeleted(fileId, msg.sender);
    }

    function getMyFileCount() external view returns (uint256) {
        return userFileIds[msg.sender].length;
    }
}
