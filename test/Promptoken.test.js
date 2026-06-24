const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Promptoken - Integration", function () {
  let registry, license, governance;
  let owner, author, consumer1, consumer2, newCustodian;
  let promptId;

  const CALL_PRICE = ethers.parseEther("0.01");
  const FIXED_PRICE = ethers.parseEther("1");
  const PLAINTEXT_PRICE = ethers.parseEther("10");
  const VOTING_DURATION = 7 * 24 * 60 * 60;

  const tiers = [
    { price: CALL_PRICE, enabled: true },
    { price: FIXED_PRICE, enabled: true },
    { price: PLAINTEXT_PRICE, enabled: true },
  ];

  beforeEach(async function () {
    [owner, author, consumer1, consumer2, newCustodian] = await ethers.getSigners();

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
  });

  describe("1. Full happy path: Register → License → Execute", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://storage-hash",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should complete the full register → license → execute flow", async function () {
      const prompt = await registry.getPrompt(promptId);
      expect(prompt.author).to.equal(author.address);
      expect(prompt.active).to.be.true;
      expect(await registry.isPromptActive(promptId)).to.be.true;

      const calls = 10;
      const cost = CALL_PRICE * BigInt(calls);
      await expect(
        license.connect(consumer1).purchaseCallLicense(promptId, calls, { value: cost })
      )
        .to.emit(license, "CallLicensePurchased")
        .withArgs(BigInt(promptId), consumer1.address, calls, cost);

      expect(await license.getRemainingCalls(promptId, consumer1.address)).to.equal(calls);

      await expect(
        license.connect(owner).executeCall(promptId, consumer1.address)
      )
        .to.emit(license, "CallExecuted")
        .withArgs(BigInt(promptId), consumer1.address, calls - 1);

      expect(await license.getRemainingCalls(promptId, consumer1.address)).to.equal(calls - 1);
    });

    it("Should allow a different consumer to purchase call license independently", async function () {
      const calls = 5;
      const cost = CALL_PRICE * BigInt(calls);

      await license.connect(consumer1).purchaseCallLicense(promptId, calls, { value: cost });
      await license.connect(consumer2).purchaseCallLicense(promptId, calls, { value: cost });

      expect(await license.getRemainingCalls(promptId, consumer1.address)).to.equal(calls);
      expect(await license.getRemainingCalls(promptId, consumer2.address)).to.equal(calls);

      await license.connect(owner).executeCall(promptId, consumer1.address);
      await license.connect(owner).executeCall(promptId, consumer2.address);

      expect(await license.getRemainingCalls(promptId, consumer1.address)).to.equal(calls - 1);
      expect(await license.getRemainingCalls(promptId, consumer2.address)).to.equal(calls - 1);
    });
  });

  describe("2. Full happy path: Fixed license", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://storage-hash",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should purchase a fixed license and set correct expiry", async function () {
      const durationDays = 30;

      const tx = await license.connect(consumer1).purchaseFixedLicense(promptId, durationDays, { value: FIXED_PRICE });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedEndTime = block.timestamp + durationDays * 86400;

      await expect(tx)
        .to.emit(license, "FixedLicensePurchased")
        .withArgs(BigInt(promptId), consumer1.address, durationDays, expectedEndTime, FIXED_PRICE);

      const expiry = await license.getLicenseExpiry(promptId, consumer1.address);
      expect(expiry).to.equal(expectedEndTime);
    });

    it("Should show fixed license as expired after duration passes", async function () {
      await license.connect(consumer1).purchaseFixedLicense(promptId, 30, { value: FIXED_PRICE });
      expect(await license.getLicenseExpiry(promptId, consumer1.address)).to.be.gt(0);

      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await license.getLicenseExpiry(promptId, consumer1.address)).to.equal(0);
    });
  });

  describe("3. Full happy path: Plaintext purchase", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://storage-hash",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should purchase plaintext and reject duplicate purchase", async function () {
      await expect(
        license.connect(consumer1).purchasePlaintext(promptId, { value: PLAINTEXT_PRICE })
      )
        .to.emit(license, "PlaintextPurchased")
        .withArgs(BigInt(promptId), consumer1.address, PLAINTEXT_PRICE);

      await expect(
        license.connect(consumer1).purchasePlaintext(promptId, { value: PLAINTEXT_PRICE })
      ).to.be.revertedWithCustomError(license, "AlreadyPurchasedPlaintext");
    });

    it("Should allow different consumer to purchase plaintext for same prompt", async function () {
      await license.connect(consumer1).purchasePlaintext(promptId, { value: PLAINTEXT_PRICE });

      await expect(
        license.connect(consumer2).purchasePlaintext(promptId, { value: PLAINTEXT_PRICE })
      )
        .to.emit(license, "PlaintextPurchased")
        .withArgs(BigInt(promptId), consumer2.address, PLAINTEXT_PRICE);
    });
  });

  describe("4. Author withdraws funds", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://storage-hash",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should accumulate funds from multiple consumers and allow author withdrawal", async function () {
      const callCost = CALL_PRICE * 10n;
      await license.connect(consumer1).purchaseCallLicense(promptId, 10, { value: callCost });

      await license.connect(consumer2).purchaseFixedLicense(promptId, 30, { value: FIXED_PRICE });

      const expectedTotal = callCost + FIXED_PRICE;
      expect(await license.getAuthorBalance(author.address)).to.equal(expectedTotal);

      const balanceBefore = await ethers.provider.getBalance(author.address);

      const tx = await license.connect(author).withdrawFunds();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      await expect(tx)
        .to.emit(license, "FundsWithdrawn")
        .withArgs(author.address, expectedTotal);

      expect(await license.getAuthorBalance(author.address)).to.equal(0);

      const balanceAfter = await ethers.provider.getBalance(author.address);
      expect(balanceAfter - balanceBefore + gasCost).to.equal(expectedTotal);
    });

    it("Should allow multiple withdrawals across prompts", async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://prompt-2",
        ethers.keccak256(ethers.toUtf8Bytes("second prompt")),
        "ipfs://meta-2",
        tiers
      );

      const cost = CALL_PRICE * 5n;
      await license.connect(consumer1).purchaseCallLicense(1, 5, { value: cost });
      expect(await license.getAuthorBalance(author.address)).to.equal(cost);

      await license.connect(author).withdrawFunds();
      expect(await license.getAuthorBalance(author.address)).to.equal(0);

      await license.connect(consumer1).purchaseCallLicense(2, 5, { value: cost });
      expect(await license.getAuthorBalance(author.address)).to.equal(cost);
    });
  });

  describe("5. Governance flow: Propose → Vote → Execute transfer", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://storage-hash",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should transfer custody through full governance flow", async function () {
      await license.connect(consumer1).purchaseCallLicense(promptId, 10, {
        value: CALL_PRICE * 10n,
      });

      const proposeTx = await governance.connect(consumer1).proposeTransfer(promptId, newCustodian.address);
      await expect(proposeTx)
        .to.emit(governance, "TransferProposed")
        .withArgs(1n, BigInt(promptId), consumer1.address, newCustodian.address, await getDeadline(proposeTx));

      let proposal = await governance.getProposal(1);
      expect(proposal.votesFor).to.equal(1n);

      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: CALL_PRICE * 5n,
      });

      const voteTx = await governance.connect(consumer2).voteTransfer(1, true);
      await expect(voteTx)
        .to.emit(governance, "VoteCast")
        .withArgs(1n, consumer2.address, true, 1n);

      proposal = await governance.getProposal(1);
      expect(proposal.votesFor).to.equal(2n);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine");

      const executeTx = await governance.connect(consumer1).executeTransfer(1);
      await expect(executeTx)
        .to.emit(governance, "TransferExecuted")
        .withArgs(1n, BigInt(promptId), newCustodian.address);

      const prompt = await registry.getPrompt(promptId);
      expect(prompt.author).to.equal(newCustodian.address);
    });
  });

  describe("6. Governance: Quorum not reached", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://storage-hash",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should reject execution when quorum is below 51%", async function () {
      await license.connect(consumer1).purchaseCallLicense(promptId, 10, {
        value: CALL_PRICE * 10n,
      });

      await governance.connect(consumer1).proposeTransfer(promptId, newCustodian.address);

      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: CALL_PRICE * 5n,
      });

      await governance.connect(consumer2).voteTransfer(1, false);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine");

      const votes = await governance.getProposalVoteCount(1);
      expect(votes.forVotes).to.equal(1n);
      expect(votes.againstVotes).to.equal(1n);

      await expect(
        governance.executeTransfer(1)
      ).to.be.revertedWithCustomError(governance, "QuorumNotReached");
    });

    it("Should reject execution with majority voting no (33% for < 51%)", async function () {
      await license.connect(consumer1).purchaseCallLicense(promptId, 10, {
        value: CALL_PRICE * 10n,
      });
      await governance.connect(consumer1).proposeTransfer(promptId, newCustodian.address);

      await license.connect(consumer2).purchaseCallLicense(promptId, 5, {
        value: CALL_PRICE * 5n,
      });
      await governance.connect(consumer2).voteTransfer(1, false);

      const otherVoter = newCustodian;
      await license.connect(otherVoter).purchaseCallLicense(promptId, 3, {
        value: CALL_PRICE * 3n,
      });
      await governance.connect(otherVoter).voteTransfer(1, false);

      await ethers.provider.send("evm_increaseTime", [VOTING_DURATION + 1]);
      await ethers.provider.send("evm_mine");

      const votes = await governance.getProposalVoteCount(1);
      expect(votes.forVotes).to.equal(1n);
      expect(votes.againstVotes).to.equal(2n);

      await expect(
        governance.executeTransfer(1)
      ).to.be.revertedWithCustomError(governance, "QuorumNotReached");
    });
  });

  describe("7. Multi-prompt scenario", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://prompt-1",
        ethers.keccak256(ethers.toUtf8Bytes("prompt one")),
        "ipfs://meta-1",
        tiers
      );
      await registry.connect(author).registerPrompt(
        "ipfs://prompt-2",
        ethers.keccak256(ethers.toUtf8Bytes("prompt two")),
        "ipfs://meta-2",
        tiers
      );
      await registry.connect(author).registerPrompt(
        "ipfs://prompt-3",
        ethers.keccak256(ethers.toUtf8Bytes("prompt three")),
        "ipfs://meta-3",
        tiers
      );
    });

    it("Should handle independent licensing and execution across multiple prompts", async function () {
      const cost1 = CALL_PRICE * 5n;
      const cost2 = CALL_PRICE * 10n;
      const cost3 = CALL_PRICE * 3n;

      await license.connect(consumer1).purchaseCallLicense(1, 5, { value: cost1 });
      await license.connect(consumer1).purchaseCallLicense(2, 10, { value: cost2 });
      await license.connect(consumer1).purchaseCallLicense(3, 3, { value: cost3 });

      expect(await license.getRemainingCalls(1, consumer1.address)).to.equal(5);
      expect(await license.getRemainingCalls(2, consumer1.address)).to.equal(10);
      expect(await license.getRemainingCalls(3, consumer1.address)).to.equal(3);

      await license.connect(owner).executeCall(1, consumer1.address);
      await license.connect(owner).executeCall(2, consumer1.address);
      await license.connect(owner).executeCall(2, consumer1.address);
      await license.connect(owner).executeCall(3, consumer1.address);

      expect(await license.getRemainingCalls(1, consumer1.address)).to.equal(4);
      expect(await license.getRemainingCalls(2, consumer1.address)).to.equal(8);
      expect(await license.getRemainingCalls(3, consumer1.address)).to.equal(2);

      const fixedCost = FIXED_PRICE;
      await license.connect(consumer2).purchaseFixedLicense(1, 30, { value: fixedCost });
      await license.connect(consumer2).purchaseCallLicense(2, 7, { value: CALL_PRICE * 7n });

      expect(await license.getLicenseExpiry(1, consumer2.address)).to.be.gt(0);
      expect(await license.getRemainingCalls(2, consumer2.address)).to.equal(7);
    });
  });

  describe("8. Edge case: Multiple versions", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(
        "ipfs://v1",
        ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
        "ipfs://metadata",
        tiers
      );
      promptId = 1;
    });

    it("Should track versions and keep old versions accessible", async function () {
      expect(await registry.getVersionCount(promptId)).to.equal(1);

      await registry.connect(author).publishVersion(promptId, "ipfs://v2");
      expect(await registry.getVersionCount(promptId)).to.equal(2);

      const v1 = await registry.getVersion(promptId, 0);
      expect(v1.storageHash).to.equal("ipfs://v1");
      expect(v1.versionNumber).to.equal(1n);

      const v2 = await registry.getVersion(promptId, 1);
      expect(v2.storageHash).to.equal("ipfs://v2");
      expect(v2.versionNumber).to.equal(2n);
    });

    it("Should allow licensing against a prompt with multiple versions", async function () {
      await registry.connect(author).publishVersion(promptId, "ipfs://v2");
      await registry.connect(author).publishVersion(promptId, "ipfs://v3");

      expect(await registry.getVersionCount(promptId)).to.equal(3);

      const cost = CALL_PRICE * 5n;
      await license.connect(consumer1).purchaseCallLicense(promptId, 5, { value: cost });
      expect(await license.getRemainingCalls(promptId, consumer1.address)).to.equal(5);

      await license.connect(owner).executeCall(promptId, consumer1.address);
      expect(await license.getRemainingCalls(promptId, consumer1.address)).to.equal(4);
    });
  });
});

async function getDeadline(tx) {
  const receipt = await tx.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  return block.timestamp + 7 * 24 * 60 * 60;
}
