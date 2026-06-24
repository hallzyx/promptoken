// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPromptGovernance
 * @notice Interface for the PromptGovernance contract enabling custody transfer
 *         of prompts through quorum-based voting among active license holders.
 */
interface IPromptGovernance {
    struct Proposal {
        uint256 promptId;
        address newCustodian;
        address proposer;
        uint256 deadline;
        bool executed;
        uint256 votesFor;
        uint256 votesAgainst;
    }

    event TransferProposed(
        uint256 indexed proposalId,
        uint256 indexed promptId,
        address indexed proposer,
        address newCustodian,
        uint256 deadline
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool indexed support,
        uint256 weight
    );

    event TransferExecuted(
        uint256 indexed proposalId,
        uint256 indexed promptId,
        address newCustodian
    );

    event ProposalCancelled(uint256 indexed proposalId);

    function proposeTransfer(uint256 promptId, address newCustodian) external returns (uint256 proposalId);

    function voteTransfer(uint256 proposalId, bool support) external;

    function executeTransfer(uint256 proposalId) external;

    function cancelProposal(uint256 proposalId) external;

    function getProposal(uint256 proposalId) external view returns (Proposal memory);

    function getProposalVoteCount(uint256 proposalId) external view returns (uint256 forVotes, uint256 againstVotes);

    function getQuorumPercentage() external view returns (uint256);

    function getVotingDuration() external view returns (uint256);
}
