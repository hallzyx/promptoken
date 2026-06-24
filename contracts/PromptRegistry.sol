// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPromptRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract PromptRegistry is IPromptRegistry, Ownable, Pausable {
    uint256 private _nextPromptId;
    address private _governance;

    mapping(uint256 => Prompt) private _prompts;
    mapping(uint256 => Version[]) private _versions;
    mapping(uint256 => mapping(uint8 => TierConfig)) private _tierConfigs;
    mapping(address => uint256[]) private _authorPromptIds;
    mapping(address => uint256) private _authorPromptCount;

    error PromptRegistry__PromptNotFound(uint256 promptId);
    error PromptRegistry__NotAuthor(uint256 promptId, address caller);
    error PromptRegistry__InvalidStorageHash();
    error PromptRegistry__InvalidPromptHash();
    error PromptRegistry__InvalidTierConfig();
    error PromptRegistry__VersionNotFound();
    error PromptRegistry__PromptDeactivated();
    error PromptRegistry__IndexOutOfBounds();
    error PromptRegistry__NotGovernance();
    error PromptRegistry__InvalidCustodian();

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    modifier onlyAuthor(uint256 promptId) {
        if (_prompts[promptId].author != msg.sender) {
            revert PromptRegistry__NotAuthor(promptId, msg.sender);
        }
        _;
    }

    modifier onlyGovernance() {
        if (msg.sender != _governance) {
            revert PromptRegistry__NotGovernance();
        }
        _;
    }

    modifier promptExists(uint256 promptId) {
        if (_prompts[promptId].author == address(0)) {
            revert PromptRegistry__PromptNotFound(promptId);
        }
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        _nextPromptId = 1;
    }

    function registerPrompt(
        string calldata storageHash,
        bytes32 promptHash,
        string calldata metadataURI,
        TierConfig[] calldata tiers
    ) external whenNotPaused returns (uint256 promptId) {
        if (bytes(storageHash).length == 0) {
            revert PromptRegistry__InvalidStorageHash();
        }
        if (promptHash == bytes32(0)) {
            revert PromptRegistry__InvalidPromptHash();
        }
        if (tiers.length == 0) {
            revert PromptRegistry__InvalidTierConfig();
        }

        promptId = _nextPromptId++;

        _prompts[promptId] = Prompt({
            author: msg.sender,
            storageHash: storageHash,
            promptHash: promptHash,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            active: true
        });

        _versions[promptId].push(
            Version({
                storageHash: storageHash,
                timestamp: block.timestamp,
                versionNumber: 1
            })
        );

        for (uint8 i = 0; i < tiers.length; i++) {
            _tierConfigs[promptId][i] = tiers[i];
        }

        _authorPromptIds[msg.sender].push(promptId);
        _authorPromptCount[msg.sender]++;

        emit PromptRegistered(promptId, msg.sender, promptHash, block.timestamp);
        emit VersionPublished(promptId, 1, storageHash, block.timestamp);
    }

    function publishVersion(
        uint256 promptId,
        string calldata newStorageHash
    ) external whenNotPaused onlyAuthor(promptId) {
        if (!_prompts[promptId].active) {
            revert PromptRegistry__PromptDeactivated();
        }
        if (bytes(newStorageHash).length == 0) {
            revert PromptRegistry__InvalidStorageHash();
        }

        uint256 newVersionNumber = _versions[promptId].length + 1;

        _versions[promptId].push(
            Version({
                storageHash: newStorageHash,
                timestamp: block.timestamp,
                versionNumber: newVersionNumber
            })
        );

        emit VersionPublished(promptId, newVersionNumber, newStorageHash, block.timestamp);
    }

    function setTierConfig(
        uint256 promptId,
        Tier tier,
        uint256 price,
        bool enabled
    ) external whenNotPaused onlyAuthor(promptId) {
        _tierConfigs[promptId][uint8(tier)] = TierConfig({price: price, enabled: enabled});

        emit TierConfigUpdated(promptId, tier, price, enabled);
    }

    function deactivatePrompt(uint256 promptId) external whenNotPaused onlyAuthor(promptId) {
        _prompts[promptId].active = false;
        emit PromptDeactivated(promptId);
    }

    function getPrompt(uint256 promptId) external view promptExists(promptId) returns (Prompt memory) {
        return _prompts[promptId];
    }

    function getVersion(
        uint256 promptId,
        uint256 versionIndex
    ) external view promptExists(promptId) returns (Version memory) {
        if (versionIndex >= _versions[promptId].length) {
            revert PromptRegistry__VersionNotFound();
        }
        return _versions[promptId][versionIndex];
    }

    function getVersionCount(uint256 promptId) external view promptExists(promptId) returns (uint256) {
        return _versions[promptId].length;
    }

    function getAuthorPromptCount(address author) external view returns (uint256) {
        return _authorPromptCount[author];
    }

    function getPromptIdByIndex(address author, uint256 index) external view returns (uint256) {
        if (index >= _authorPromptIds[author].length) {
            revert PromptRegistry__IndexOutOfBounds();
        }
        return _authorPromptIds[author][index];
    }

    function getTierConfig(
        uint256 promptId,
        Tier tier
    ) external view promptExists(promptId) returns (TierConfig memory) {
        return _tierConfigs[promptId][uint8(tier)];
    }

    function isPromptActive(uint256 promptId) external view returns (bool) {
        return _prompts[promptId].author != address(0) && _prompts[promptId].active;
    }

    function setGovernance(address governance) external onlyOwner {
        _governance = governance;
    }

    function transferCustody(
        uint256 promptId,
        address newCustodian
    ) external onlyGovernance promptExists(promptId) {
        if (newCustodian == address(0)) {
            revert PromptRegistry__InvalidCustodian();
        }

        Prompt storage prompt = _prompts[promptId];
        address oldAuthor = prompt.author;

        prompt.author = newCustodian;

        uint256[] storage oldList = _authorPromptIds[oldAuthor];
        for (uint256 i = 0; i < oldList.length; i++) {
            if (oldList[i] == promptId) {
                oldList[i] = oldList[oldList.length - 1];
                oldList.pop();
                break;
            }
        }
        _authorPromptCount[oldAuthor]--;

        _authorPromptIds[newCustodian].push(promptId);
        _authorPromptCount[newCustodian]++;

        emit PromptCustodyTransferred(promptId, oldAuthor, newCustodian);
    }
}
