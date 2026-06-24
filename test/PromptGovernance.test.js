const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PromptGovernance", function () {
  let registry, license, governance;
  let owner, author, consumer, consumer2, newCustodian;
  let promptId;

  const storageHash = "QmTest123";
  const promptHash = ethers.keccak256(ethers.toUtf8Bytes("test prompt"));
  const metadataURI = "https://example.com/metadata.json";

  const tiers = [
    { price: ethers.parseEther("0.01"), enabled: true },
    { price: ethers.parseEther("1"), enabled: true },
    { price: ethers.parseEther("10"), enabled: true },
  ];

  const VOTING_DURATION = 7 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, author, consumer, consumer2, newCustodian] = await ethers.getSigners();

    const PromptRegistry = await ethers.getContractFactory("PromptRegistry");
    registry = await PromptRegistry.deploy(owner.address);

    const PromptLicense = await ethers.getContractFactory("PromptLicense");
    license = await PromptLicense.deploy(await registry.getAddress());

    const PromptGovernance = await ethers.getContractFactory("PromptGovernance");
    governance = await PromptGovernance.deploy(
      owner.address,
      await registry.getAddress(),
      await license.getAddress()
    );

    await registry.setGovernance(await governance.getAddress());

    await registry.connect(author).registerPrompt(
      storageHash,
      promptHash,
      metadataURI,
      tiers
    );
    promptId = 1;

    await license.connect(consumer).purchaseCallLicense(promptId, 10, {
      value: ethers.parseEther("0.1"),
    });
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await governance.owner()).to.equal(owner.address);
    });

    it("Should set the correct registry address", async function () {
      expect(await governance.getQuorumPercentage()).to.equal(51n);
    });

    it("Should set the correct voting duration", async function () {
      expect(await governance.getVotingDuration()).to.equal(VOTING_DURATION);
    });

    it("Should have QUORUM_PERCENTAGE = 51", async function () {
      expect(await governance.getQuorumPercentage()).to.equal(51n);
    });

    it("Should have VOTING_DURATION = 7 days", async function () {
      expect(await governance.getVotingDuration()).to.equal(VOTING_DURATION);
    });
  });

  describe("proposeTransfer", function () {
    it("Should create a proposal successfully", async function () {
      const tx = await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);
      const receipt = await tx.wait();

      const proposal = await governance.getProposal(1);
      expect(proposal.promptId).to.equal(promptId);
      expect(proposal.newCustodian).to.equal(newCustodian.address);
      expect(proposal.proposer).to.equal(consumer.address);
      expect(proposal.executed).to.be.false;
      expect(proposal.votesFor).to.equal(1n);
      expect(proposal.votesAgainst).to.equal(0n);
    });

    it("Should emit TransferProposed and VoteCast events", async function () {
      const tx = await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const deadline = block.timestamp + VOTING_DURATION;

      await expect(tx)
        .to.emit(governance, "TransferProposed")
        .withArgs(1n, promptId, consumer.address, newCustodian.address, deadline);

      await expect(tx)
        .to.emit(governance, "VoteCast")
        .withArgs(1n, consumer.address, true, 1n);
    });

    it("Should auto-vote yes for proposer", async function () {
      await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);
      const proposal = await governance.getProposal(1);
      expect(proposal.votesFor).to.equal(1n);
    });

    it("Should reject if caller has no active license", async function () {
      await expect(
        governance.connect(consumer2).proposeTransfer(promptId, newCustodian.address)
      ).to.be.revertedWithCustomError(governance, "NoActiveLicense");
    });

    it("Should reject if proposer == newCustodian", async function () {
      await expect(
        governance.connect(consumer).proposeTransfer(promptId, consumer.address)
      ).to.be.revertedWithCustomError(governance, "SameAddress");
    });

    it("Should reject if prompt does not exist", async function () {
      await expect(
        governance.connect(consumer).proposeTransfer(999, newCustodian.address)
      ).to.be.revertedWithCustomError(governance, "PromptNotActive");
    });
  });

  describe("voteTransfer", function () {
    beforeEach(async function () {
      await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);
    });

    it("Should vote yes successfully", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });

      await governance.connect(consumer2).voteTransfer(1, true);
      const proposal = await governance.getProposal(1);
      expect(proposal.votesFor).to.equal(2n);
    });

    it("Should vote no successfully", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });

      await governance.connect(consumer2).voteTransfer(1, false);
      const proposal = await governance.getProposal(1);
      expect(proposal.votesAgainst).to.equal(1n);
    });

    it("Should emit VoteCast on yes vote", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });

      const tx = await governance.connect(consumer2).voteTransfer(1, true);
      await expect(tx)
        .to.emit(governance, "VoteCast")
        .withArgs(1n, consumer2.address, true, 1n);
    });

    it("Should emit VoteCast on no vote", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });

      const tx = await governance.connect(consumer2).voteTransfer(1, false);
      await expect(tx)
        .to.emit(governance, "VoteCast")
        .withArgs(1n, consumer2.address, false, 1n);
    });

    it("Should reject if already voted", async function () {
      await expect(
        governance.connect(consumer).voteTransfer(1, true)
      ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
    });

    it("Should reject if voter has no active license", async function () {
      await expect(
        governance.connect(consumer2).voteTransfer(1, true)
      ).to.be.revertedWithCustomError(governance, "NoActiveLicense");
    });

    it("Should reject if voting period ended", async function () {
      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        governance.connect(consumer).voteTransfer(1, true)
      ).to.be.revertedWithCustomError(governance, "VotingPeriodEnded");
    });

    it("Should reject for non-existent proposal", async function () {
      await expect(
        governance.connect(consumer).voteTransfer(999, true)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });

  describe("executeTransfer", function () {
    beforeEach(async function () {
      await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);
    });

    it("Should NOT execute before deadline", async function () {
      await expect(
        governance.executeTransfer(1)
      ).to.be.revertedWithCustomError(governance, "VotingPeriodNotEnded");
    });

    it("Should execute after deadline with quorum reached", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });
      await governance.connect(consumer2).voteTransfer(1, true);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(governance.executeTransfer(1))
        .to.emit(governance, "TransferExecuted")
        .withArgs(1n, promptId, newCustodian.address);
    });

    it("Should update prompt author in registry after transfer", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });
      await governance.connect(consumer2).voteTransfer(1, true);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await governance.executeTransfer(1);

      const prompt = await registry.getPrompt(promptId);
      expect(prompt.author).to.equal(newCustodian.address);
    });

    it("Should reject if quorum not met (50% < 51%)", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });
      await governance.connect(consumer2).voteTransfer(1, false);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        governance.executeTransfer(1)
      ).to.be.revertedWithCustomError(governance, "QuorumNotReached");
    });

    it("Should reject if already executed", async function () {
      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });
      await governance.connect(consumer2).voteTransfer(1, true);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await governance.executeTransfer(1);

      await expect(
        governance.executeTransfer(1)
      ).to.be.revertedWithCustomError(governance, "ProposalExecuted");
    });

    it("Should reject for non-existent proposal", async function () {
      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        governance.executeTransfer(999)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });

  describe("cancelProposal", function () {
    beforeEach(async function () {
      await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);
    });

    it("Should cancel by owner", async function () {
      const tx = await governance.connect(owner).cancelProposal(1);
      await expect(tx)
        .to.emit(governance, "ProposalCancelled")
        .withArgs(1n);
    });

    it("Should cancel by proposer", async function () {
      const tx = await governance.connect(consumer).cancelProposal(1);
      await expect(tx)
        .to.emit(governance, "ProposalCancelled")
        .withArgs(1n);
    });

    it("Should reject cancel by unauthorized user", async function () {
      await expect(
        governance.connect(consumer2).cancelProposal(1)
      ).to.be.revertedWithCustomError(governance, "NotProposerOrOwner");
    });

    it("Should reject cancel of already executed proposal", async function () {
      await governance.connect(owner).cancelProposal(1);

      await expect(
        governance.connect(owner).cancelProposal(1)
      ).to.be.revertedWithCustomError(governance, "ProposalExecuted");
    });

    it("Should reject for non-existent proposal", async function () {
      await expect(
        governance.connect(owner).cancelProposal(999)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });

  describe("getProposal / getProposalVoteCount", function () {
    it("Should return correct proposal data", async function () {
      await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);

      const proposal = await governance.getProposal(1);
      expect(proposal.promptId).to.equal(promptId);
      expect(proposal.newCustodian).to.equal(newCustodian.address);
      expect(proposal.proposer).to.equal(consumer.address);
      expect(proposal.executed).to.be.false;
    });

    it("Should return correct vote counts", async function () {
      await governance.connect(consumer).proposeTransfer(promptId, newCustodian.address);

      const votesBefore = await governance.getProposalVoteCount(1);
      expect(votesBefore.forVotes).to.equal(1n);
      expect(votesBefore.againstVotes).to.equal(0n);

      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: ethers.parseEther("0.05"),
      });
      await governance.connect(consumer2).voteTransfer(1, false);

      const votesAfter = await governance.getProposalVoteCount(1);
      expect(votesAfter.forVotes).to.equal(1n);
      expect(votesAfter.againstVotes).to.equal(1n);
    });

    it("Should revert for non-existent proposal in getProposal", async function () {
      await expect(
        governance.getProposal(999)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });

    it("Should revert for non-existent proposal in getProposalVoteCount", async function () {
      await expect(
        governance.getProposalVoteCount(999)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });
});
