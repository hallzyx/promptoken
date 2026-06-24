// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPromptLicense.sol";
import "./interfaces/IPromptRegistry.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PromptLicense
 * @notice Manages all 3 monetization tiers for AI prompts on 0G Chain:
 *         Pay-Per-Call licenses, Fixed-term licenses, and Plaintext purchases.
 * @dev Implements pull-over-push for author payouts, ReentrancyGuard on all
 *      payable functions, and Pausable for emergency stops.
 */
contract PromptLicense is IPromptLicense, Ownable, ReentrancyGuard, Pausable {
    IPromptRegistry public immutable registry;

    uint256 public constant MAX_CALLS_PER_PURCHASE = 10000;
    uint256 public constant MAX_LICENSE_DURATION = 365 days;

    mapping(bytes32 => CallLicense) private _callLicenses;
    mapping(bytes32 => FixedLicense) private _fixedLicenses;
    mapping(bytes32 => bool) private _plaintextPurchases;
    mapping(address => uint256) private _authorBalances;

    mapping(bytes32 => uint256) private _callLicensePayments;
    mapping(bytes32 => uint256) private _fixedLicensePayments;
    mapping(bytes32 => address) private _licenseConsumers;

    error PromptNotActive();
    error TierNotEnabled();
    error InvalidCallAmount();
    error ExceedsMaxCalls(uint256 max);
    error InvalidDuration();
    error ExceedsMaxDuration(uint256 max);
    error InsufficientPayment(uint256 required, uint256 provided);
    error NoActiveLicense();
    error LicenseExpired();
    error AlreadyPurchasedPlaintext();
    error NoBalanceToWithdraw();
    error TransferFailed();

    /**
     * @param _registry Address of the deployed PromptRegistry contract.
     */
    constructor(address _registry) Ownable(msg.sender) {
        if (_registry == address(0)) revert("PromptLicense: invalid registry address");
        registry = IPromptRegistry(_registry);
    }

    /**
     * @notice Purchase a Pay-Per-Call license for a prompt.
     * @dev Overpayment is treated as a tip to the author (not refunded).
     * @param promptId The ID of the prompt to license.
     * @param calls Number of calls to purchase.
     */
    function purchaseCallLicense(uint256 promptId, uint256 calls) external payable nonReentrant whenNotPaused {
        if (!registry.isPromptActive(promptId)) revert PromptNotActive();

        IPromptRegistry.TierConfig memory tierConfig = registry.getTierConfig(promptId, IPromptRegistry.Tier.PayPerCall);
        if (!tierConfig.enabled) revert TierNotEnabled();

        if (calls == 0) revert InvalidCallAmount();
        if (calls > MAX_CALLS_PER_PURCHASE) revert ExceedsMaxCalls(MAX_CALLS_PER_PURCHASE);

        uint256 cost = tierConfig.price * calls;
        if (msg.value < cost) revert InsufficientPayment(cost, msg.value);

        bytes32 key = keccak256(abi.encodePacked(promptId, msg.sender));
        CallLicense storage license = _callLicenses[key];

        license.remainingCalls += calls;
        license.totalCalls += calls;
        if (license.expiresAt == 0 || block.timestamp >= license.expiresAt) {
            license.expiresAt = block.timestamp + MAX_LICENSE_DURATION;
        }

        _callLicensePayments[key] += msg.value;
        if (_licenseConsumers[key] == address(0)) {
            _licenseConsumers[key] = msg.sender;
        }

        address author = registry.getPrompt(promptId).author;
        _authorBalances[author] += msg.value;

        emit CallLicensePurchased(promptId, msg.sender, calls, msg.value);
    }

    /**
     * @notice Purchase a Fixed-term license for a prompt.
     * @dev If the consumer already has an active license, the duration is extended.
     * @param promptId The ID of the prompt to license.
     * @param durationDays Duration of the license in days.
     */
    function purchaseFixedLicense(uint256 promptId, uint256 durationDays) external payable nonReentrant whenNotPaused {
        if (!registry.isPromptActive(promptId)) revert PromptNotActive();

        IPromptRegistry.TierConfig memory tierConfig = registry.getTierConfig(promptId, IPromptRegistry.Tier.FixedLicense);
        if (!tierConfig.enabled) revert TierNotEnabled();

        if (durationDays == 0) revert InvalidDuration();
        uint256 duration = durationDays * 1 days;
        if (duration > MAX_LICENSE_DURATION) revert ExceedsMaxDuration(MAX_LICENSE_DURATION);

        if (msg.value < tierConfig.price) revert InsufficientPayment(tierConfig.price, msg.value);

        bytes32 key = keccak256(abi.encodePacked(promptId, msg.sender));
        FixedLicense storage license = _fixedLicenses[key];

        if (license.active && block.timestamp < license.endTime) {
            license.endTime += duration;
        } else {
            license.startTime = block.timestamp;
            license.endTime = block.timestamp + duration;
            license.active = true;
        }

        _fixedLicensePayments[key] += msg.value;
        if (_licenseConsumers[key] == address(0)) {
            _licenseConsumers[key] = msg.sender;
        }

        address author = registry.getPrompt(promptId).author;
        _authorBalances[author] += msg.value;

        emit FixedLicensePurchased(promptId, msg.sender, durationDays, license.endTime, msg.value);
    }

    /**
     * @notice Purchase plaintext (full prompt content) for a prompt.
     * @dev Each consumer can only purchase plaintext once per prompt.
     *      Actual delivery happens off-chain via encrypted channel.
     * @param promptId The ID of the prompt to purchase.
     */
    function purchasePlaintext(uint256 promptId) external payable nonReentrant whenNotPaused {
        if (!registry.isPromptActive(promptId)) revert PromptNotActive();

        IPromptRegistry.TierConfig memory tierConfig = registry.getTierConfig(promptId, IPromptRegistry.Tier.Plaintext);
        if (!tierConfig.enabled) revert TierNotEnabled();

        if (msg.value < tierConfig.price) revert InsufficientPayment(tierConfig.price, msg.value);

        bytes32 key = keccak256(abi.encodePacked(promptId, msg.sender));
        if (_plaintextPurchases[key]) revert AlreadyPurchasedPlaintext();

        _plaintextPurchases[key] = true;

        address author = registry.getPrompt(promptId).author;
        _authorBalances[author] += msg.value;

        emit PlaintextPurchased(promptId, msg.sender, msg.value);
    }

    /**
     * @notice Decrement a consumer's call license (called by authorized backend).
     * @dev For MVP, only the contract owner (admin) can execute calls.
     * @param promptId The ID of the prompt being queried.
     * @param consumer The consumer whose license to debit.
     */
    function executeCall(uint256 promptId, address consumer) external nonReentrant onlyOwner {
        bytes32 key = keccak256(abi.encodePacked(promptId, consumer));
        CallLicense storage license = _callLicenses[key];

        if (license.remainingCalls == 0) revert NoActiveLicense();
        if (license.expiresAt > 0 && block.timestamp >= license.expiresAt) revert LicenseExpired();

        license.remainingCalls--;

        emit CallExecuted(promptId, consumer, license.remainingCalls);
    }

    /**
     * @notice Get the remaining calls for a consumer's call license.
     * @param promptId The ID of the prompt.
     * @param consumer The consumer address.
     * @return remainingCalls Remaining calls (0 if no license or expired).
     */
    function getRemainingCalls(uint256 promptId, address consumer) external view returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(promptId, consumer));
        CallLicense storage license = _callLicenses[key];

        if (license.expiresAt > 0 && block.timestamp >= license.expiresAt) return 0;
        return license.remainingCalls;
    }

    /**
     * @notice Get the expiry timestamp for a consumer's license.
     * @dev Checks fixed license first, then call license.
     * @param promptId The ID of the prompt.
     * @param consumer The consumer address.
     * @return expiry Expiry timestamp (0 if no active license).
     */
    function getLicenseExpiry(uint256 promptId, address consumer) external view returns (uint256) {
        bytes32 key = keccak256(abi.encodePacked(promptId, consumer));

        FixedLicense storage fixedLic = _fixedLicenses[key];
        if (fixedLic.active && block.timestamp < fixedLic.endTime) {
            return fixedLic.endTime;
        }

        CallLicense storage callLic = _callLicenses[key];
        if (callLic.expiresAt > 0 && block.timestamp < callLic.expiresAt) {
            return callLic.expiresAt;
        }

        return 0;
    }

    /**
     * @notice Get the pending withdrawal balance for an author.
     * @param author The author address.
     * @return balance The amount of ETH available for withdrawal.
     */
    function getAuthorBalance(address author) external view returns (uint256) {
        return _authorBalances[author];
    }

    /**
     * @notice Withdraw accumulated earnings (pull-over-push pattern).
     * @dev Transfers the entire balance of the caller to their address.
     */
    function withdrawFunds() external nonReentrant {
        uint256 amount = _authorBalances[msg.sender];
        if (amount == 0) revert NoBalanceToWithdraw();

        _authorBalances[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Admin function to process a pro-rata refund for a license.
     * @dev For MVP, only callable by owner. Governance integration planned.
     *      Calculates refund proportionally for remaining calls or remaining time.
     * @param promptId The ID of the prompt (for event emission).
     * @param licenseId The license key (keccak256(abi.encodePacked(promptId, consumer))).
     */
    function claimRefund(uint256 promptId, bytes32 licenseId) external nonReentrant onlyOwner {
        address consumer;
        uint256 refundAmount;

        CallLicense storage callLic = _callLicenses[licenseId];
        if (callLic.totalCalls > 0) {
            consumer = _licenseConsumers[licenseId];
            uint256 paid = _callLicensePayments[licenseId];
            uint256 unused = callLic.remainingCalls;
            if (paid > 0) {
                refundAmount = (unused * paid) / callLic.totalCalls;
            }
            delete _callLicenses[licenseId];
            delete _callLicensePayments[licenseId];
            delete _licenseConsumers[licenseId];
        } else {
            FixedLicense storage fixedLic = _fixedLicenses[licenseId];
            if (fixedLic.active) {
                consumer = _licenseConsumers[licenseId];
                uint256 paid = _fixedLicensePayments[licenseId];
                uint256 totalDuration = fixedLic.endTime - fixedLic.startTime;
                uint256 remaining = fixedLic.endTime > block.timestamp ? fixedLic.endTime - block.timestamp : 0;
                if (paid > 0 && totalDuration > 0) {
                    refundAmount = (remaining * paid) / totalDuration;
                }
                delete _fixedLicenses[licenseId];
                delete _fixedLicensePayments[licenseId];
                delete _licenseConsumers[licenseId];
            }
        }

        if (refundAmount == 0) revert NoActiveLicense();

        (bool success, ) = payable(consumer).call{value: refundAmount}("");
        if (!success) revert TransferFailed();

        emit RefundClaimed(promptId, consumer, refundAmount);
    }
}
