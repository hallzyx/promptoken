// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPromptGovernance.sol";
import "./interfaces/IPromptRegistry.sol";
import "./interfaces/IPromptLicense.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PromptGovernance
 * @notice Handles custody transfer of prompts through quorum-based voting
 *         among active license holders. Proposals are time-locked and require
 *         both quorum and simple majority to execute.
 * @dev Inherits Ownable (admin controls) and Pausable (emergency stop).
 *      References IPromptRegistry for prompt validation and IPromptLicense
 *      for voter eligibility checks.
 */
contract PromptGovernance is IPromptGovernance, Ownable, Pausable {
    IPromptRegistry private immutable _registry;
    IPromptLicense private immutable _license;

    uint256 public constant VOTING_DURATION = 7 days;
    uint256 public constant QUORUM_PERCENTAGE = 51;

    uint256 private _nextProposalId;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    error ProposalNotFound();
    error ProposalExecuted();
    error VotingPeriodEnded();
    error VotingPeriodNotEnded();
    error AlreadyVoted();
    error NoActiveLicense();
    error SameAddress();
    error QuorumNotReached(uint256 forVotes, uint256 totalVotes);
    error NotProposerOrOwner();
    error PromptNotActive();

    /**
     * @param initialOwner Address to receive Ownable ownership.
     * @param registry     Deployed PromptRegistry contract address.
     * @param license      Deployed PromptLicense contract address.
     */
    constructor(
        address initialOwner,
        IPromptRegistry registry,
        IPromptLicense license
    ) Ownable(initialOwner) {
        if (address(registry) == address(0)) revert("PromptGovernance: invalid registry");
        if (address(license) == address(0)) revert("PromptGovernance: invalid license");
        _registry = registry;
        _license = license;
        _nextProposalId = 1;
    }

    /**
     * @notice Propose a custody transfer for a prompt. The proposer auto-votes in favor.
     * @param promptId     The prompt to transfer custody of.
     * @param newCustodian The proposed new custodian address.
     * @return proposalId The assigned proposal identifier.
     */
    function proposeTransfer(
        uint256 promptId,
        address newCustodian
    ) external whenNotPaused returns (uint256 proposalId) {
        if (!_registry.isPromptActive(promptId)) revert PromptNotActive();
        if (msg.sender == newCustodian) revert SameAddress();
        if (!_hasActiveLicense(promptId, msg.sender)) revert NoActiveLicense();

        proposalId = _nextProposalId++;

        _proposals[proposalId] = Proposal({
            promptId: promptId,
            newCustodian: newCustodian,
            proposer: msg.sender,
            deadline: block.timestamp + VOTING_DURATION,
            executed: false,
            votesFor: 1,
            votesAgainst: 0
        });

        _hasVoted[proposalId][msg.sender] = true;

        emit TransferProposed(proposalId, promptId, msg.sender, newCustodian, block.timestamp + VOTING_DURATION);
        emit VoteCast(proposalId, msg.sender, true, 1);
    }

    /**
     * @notice Cast a vote on an active proposal.
     * @param proposalId The proposal to vote on.
     * @param support    True for yes, false for no.
     */
    function voteTransfer(uint256 proposalId, bool support) external whenNotPaused {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalExecuted();
        if (block.timestamp >= proposal.deadline) revert VotingPeriodEnded();
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        if (!_hasActiveLicense(proposal.promptId, msg.sender)) revert NoActiveLicense();

        _hasVoted[proposalId][msg.sender] = true;

        if (support) {
            proposal.votesFor++;
        } else {
            proposal.votesAgainst++;
        }

        emit VoteCast(proposalId, msg.sender, support, 1);
    }

    /**
     * @notice Execute a proposal after the voting period has ended.
     * @dev Requires quorum (votesFor * 100 / totalVotes >= QUORUM_PERCENTAGE)
     *      and simple majority (votesFor > votesAgainst).
     *      Transfers prompt custody on PromptRegistry.
     * @param proposalId The proposal to execute.
     */
    function executeTransfer(uint256 proposalId) external whenNotPaused {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalExecuted();
        if (block.timestamp < proposal.deadline) revert VotingPeriodNotEnded();

        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        if (totalVotes == 0) revert QuorumNotReached(proposal.votesFor, totalVotes);

        if ((proposal.votesFor * 100) / totalVotes < QUORUM_PERCENTAGE) {
            revert QuorumNotReached(proposal.votesFor, totalVotes);
        }

        proposal.executed = true;

        _registry.transferCustody(proposal.promptId, proposal.newCustodian);

        emit TransferExecuted(proposalId, proposal.promptId, proposal.newCustodian);
    }

    /**
     * @notice Cancel a proposal. Only callable by the proposer or contract owner.
     * @param proposalId The proposal to cancel.
     */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage proposal = _proposals[proposalId];
        if (proposal.proposer == address(0)) revert ProposalNotFound();
        if (proposal.executed) revert ProposalExecuted();
        if (msg.sender != proposal.proposer && msg.sender != owner()) revert NotProposerOrOwner();

        proposal.executed = true;

        emit ProposalCancelled(proposalId);
    }

    /**
     * @notice Get the full Proposal struct for a given ID.
     * @param proposalId The proposal identifier.
     * @return The Proposal struct.
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (_proposals[proposalId].proposer == address(0)) revert ProposalNotFound();
        return _proposals[proposalId];
    }

    /**
     * @notice Get vote counts for a proposal.
     * @param proposalId The proposal identifier.
     * @return forVotes     Votes in favor.
     * @return againstVotes Votes against.
     */
    function getProposalVoteCount(
        uint256 proposalId
    ) external view returns (uint256 forVotes, uint256 againstVotes) {
        if (_proposals[proposalId].proposer == address(0)) revert ProposalNotFound();
        Proposal storage proposal = _proposals[proposalId];
        return (proposal.votesFor, proposal.votesAgainst);
    }

    /**
     * @notice Get the quorum percentage constant.
     * @return The quorum percentage (51 = 51%).
     */
    function getQuorumPercentage() external pure returns (uint256) {
        return QUORUM_PERCENTAGE;
    }

    /**
     * @notice Get the voting duration constant.
     * @return The voting duration in seconds (7 days).
     */
    function getVotingDuration() external pure returns (uint256) {
        return VOTING_DURATION;
    }

    /**
     * @notice Check if a voter has an active license for a prompt.
     * @dev A voter is eligible if they have remaining call credits or
     *      an unexpired fixed license.
     * @param promptId The prompt to check.
     * @param voter    The voter address.
     * @return True if the voter has an active license.
     */
    function _hasActiveLicense(uint256 promptId, address voter) private view returns (bool) {
        return _license.getRemainingCalls(promptId, voter) > 0
            || _license.getLicenseExpiry(promptId, voter) > block.timestamp;
    }
}
