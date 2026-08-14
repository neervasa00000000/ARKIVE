// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WalletLinker {
    uint256 public constant MAX_WALLETS_PER_IDENTITY = 3;

    mapping(address => address[]) public linkedWallets;
    mapping(address => address) public primaryOf;
    mapping(address => address) public pendingLinks;

    event WalletLinked(address indexed primary, address indexed secondary, uint256 timestamp);
    event WalletUnlinked(address indexed primary, address indexed secondary, uint256 timestamp);
    event LinkRequested(address indexed secondary, address indexed primary, uint256 timestamp);
    event LinkCancelled(address indexed secondary, address indexed primary, uint256 timestamp);

    function getPrimary(address wallet) external view returns (address) {
        if (primaryOf[wallet] != address(0)) {
            return primaryOf[wallet];
        }
        return wallet;
    }

    function getLinkedWallets(address primary) external view returns (address[] memory) {
        return linkedWallets[primary];
    }

    function getIdentitySize(address wallet) external view returns (uint256) {
        address primary = primaryOf[wallet] != address(0) ? primaryOf[wallet] : wallet;
        return linkedWallets[primary].length + 1;
    }

    function canAddMoreWallets(address wallet) external view returns (bool) {
        address primary = primaryOf[wallet] != address(0) ? primaryOf[wallet] : wallet;
        return linkedWallets[primary].length < MAX_WALLETS_PER_IDENTITY - 1;
    }

    function areSameIdentity(address wallet1, address wallet2) external view returns (bool) {
        if (wallet1 == wallet2) return true;
        address p1 = primaryOf[wallet1] != address(0) ? primaryOf[wallet1] : wallet1;
        address p2 = primaryOf[wallet2] != address(0) ? primaryOf[wallet2] : wallet2;
        return p1 == p2;
    }

    function hasPendingRequest(address secondary) external view returns (address) {
        return pendingLinks[secondary];
    }

    function requestLink(address primaryWallet) external {
        require(msg.sender != primaryWallet, "Cannot link to yourself");
        require(primaryOf[msg.sender] == address(0), "Already linked to a primary wallet");
        require(primaryOf[primaryWallet] == address(0), "Target wallet is itself a secondary");
        require(
            linkedWallets[primaryWallet].length < MAX_WALLETS_PER_IDENTITY - 1,
            "Primary wallet already has maximum linked wallets"
        );
        require(pendingLinks[msg.sender] == address(0), "Already has a pending request");

        pendingLinks[msg.sender] = primaryWallet;
        emit LinkRequested(msg.sender, primaryWallet, block.timestamp);
    }

    function confirmLink(address secondaryWallet) external {
        require(
            pendingLinks[secondaryWallet] == msg.sender,
            "No pending request from this wallet to you"
        );
        require(
            linkedWallets[msg.sender].length < MAX_WALLETS_PER_IDENTITY - 1,
            "Maximum wallets already linked"
        );
        require(primaryOf[secondaryWallet] == address(0), "Secondary already linked elsewhere");

        linkedWallets[msg.sender].push(secondaryWallet);
        primaryOf[secondaryWallet] = msg.sender;
        delete pendingLinks[secondaryWallet];

        emit WalletLinked(msg.sender, secondaryWallet, block.timestamp);
    }

    function cancelLinkRequest() external {
        address requestedPrimary = pendingLinks[msg.sender];
        require(requestedPrimary != address(0), "No pending request to cancel");

        delete pendingLinks[msg.sender];
        emit LinkCancelled(msg.sender, requestedPrimary, block.timestamp);
    }

    function unlinkWallet(address walletToUnlink) external {
        address primary;
        address secondary;

        if (primaryOf[walletToUnlink] == msg.sender) {
            primary = msg.sender;
            secondary = walletToUnlink;
        } else if (msg.sender == walletToUnlink && primaryOf[msg.sender] != address(0)) {
            primary = primaryOf[msg.sender];
            secondary = msg.sender;
        } else {
            revert("Not authorised to unlink this wallet");
        }

        address[] storage wallets = linkedWallets[primary];
        for (uint256 i = 0; i < wallets.length; i++) {
            if (wallets[i] == secondary) {
                wallets[i] = wallets[wallets.length - 1];
                wallets.pop();
                break;
            }
        }

        delete primaryOf[secondary];
        emit WalletUnlinked(primary, secondary, block.timestamp);
    }
}
