// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPromptRegistry
 * @notice Interface for the PromptRegistry contract that manages prompt IP registration
 *         and versioning on 0G Chain.
 */
interface IPromptRegistry {
    enum Tier { PayPerCall, FixedLicense, Plaintext }

    struct TierConfig {
        uint256 price;
        bool enabled;
    }

    struct Prompt {
        address author;
        string storageHash;
        bytes32 promptHash;
        string metadataURI;
        uint256 createdAt;
        bool active;
    }

    struct Version {
        string storageHash;
        uint256 timestamp;
        uint256 versionNumber;
    }

    event PromptRegistered(
        uint256 indexed promptId,
        address indexed author,
        bytes32 indexed promptHash,
        uint256 timestamp
    );

    event VersionPublished(
        uint256 indexed promptId,
        uint256 indexed versionNumber,
        string storageHash,
        uint256 timestamp
    );

    event TierConfigUpdated(
        uint256 indexed promptId,
        Tier indexed tier,
        uint256 price,
        bool enabled
    );

    event PromptDeactivated(uint256 indexed promptId);

    event PromptCustodyTransferred(
        uint256 indexed promptId,
        address indexed oldAuthor,
        address indexed newCustodian
    );

    function transferCustody(uint256 promptId, address newCustodian) external;

    function setGovernance(address governance) external;

    function registerPrompt(
        string calldata storageHash,
        bytes32 promptHash,
        string calldata metadataURI,
        TierConfig[] calldata tiers
    ) external returns (uint256 promptId);

    function publishVersion(uint256 promptId, string calldata newStorageHash) external;

    function setTierConfig(uint256 promptId, Tier tier, uint256 price, bool enabled) external;

    function deactivatePrompt(uint256 promptId) external;

    function getPrompt(uint256 promptId) external view returns (Prompt memory);

    function getVersion(uint256 promptId, uint256 versionIndex) external view returns (Version memory);

    function getVersionCount(uint256 promptId) external view returns (uint256);

    function getAuthorPromptCount(address author) external view returns (uint256);

    function getPromptIdByIndex(address author, uint256 index) external view returns (uint256);

    function getTierConfig(uint256 promptId, Tier tier) external view returns (TierConfig memory);

    function isPromptActive(uint256 promptId) external view returns (bool);
}
