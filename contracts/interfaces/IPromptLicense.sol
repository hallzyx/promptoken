// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPromptLicense
 * @notice Interface for the PromptLicense contract managing 3-tier monetization
 *         of AI prompts on 0G Chain.
 */
interface IPromptLicense {
    struct CallLicense {
        uint256 remainingCalls;
        uint256 totalCalls;
        uint256 expiresAt;
    }

    struct FixedLicense {
        uint256 startTime;
        uint256 endTime;
        bool active;
    }

    event CallLicensePurchased(
        uint256 indexed promptId,
        address indexed consumer,
        uint256 calls,
        uint256 totalPaid
    );

    event FixedLicensePurchased(
        uint256 indexed promptId,
        address indexed consumer,
        uint256 durationDays,
        uint256 endTime,
        uint256 totalPaid
    );

    event PlaintextPurchased(
        uint256 indexed promptId,
        address indexed buyer,
        uint256 totalPaid
    );

    event CallExecuted(
        uint256 indexed promptId,
        address indexed consumer,
        uint256 callsRemaining
    );

    event RefundClaimed(
        uint256 indexed promptId,
        address indexed consumer,
        uint256 amount
    );

    event FundsWithdrawn(
        address indexed author,
        uint256 amount
    );

    function purchaseCallLicense(uint256 promptId, uint256 calls) external payable;

    function purchaseFixedLicense(uint256 promptId, uint256 durationDays) external payable;

    function purchasePlaintext(uint256 promptId) external payable;

    function executeCall(uint256 promptId, address consumer) external;

    function getRemainingCalls(uint256 promptId, address consumer) external view returns (uint256);

    function getLicenseExpiry(uint256 promptId, address consumer) external view returns (uint256);

    function getAuthorBalance(address author) external view returns (uint256);

    function withdrawFunds() external;

    function claimRefund(uint256 promptId, bytes32 licenseId) external;
}
