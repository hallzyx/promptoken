const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PromptLicense", function () {
  let registry, license;
  let owner, author, consumer, consumer2;

  const CALL_PRICE = ethers.parseEther("0.01");
  const FIXED_PRICE = ethers.parseEther("1");
  const PLAINTEXT_PRICE = ethers.parseEther("10");

  function computeKey(promptId, consumerAddress) {
    return ethers.keccak256(
      ethers.solidityPacked(["uint256", "address"], [promptId, consumerAddress])
    );
  }

  beforeEach(async function () {
    [owner, author, consumer, consumer2] = await ethers.getSigners();

    const PromptRegistry = await ethers.getContractFactory("PromptRegistry");
    registry = await PromptRegistry.deploy(owner.address);

    const PromptLicense = await ethers.getContractFactory("PromptLicense");
    license = await PromptLicense.deploy(await registry.getAddress());

    const tiers = [
      { price: CALL_PRICE, enabled: true },
      { price: FIXED_PRICE, enabled: true },
      { price: PLAINTEXT_PRICE, enabled: true },
    ];

    await registry.connect(author).registerPrompt(
      "ipfs://storage-hash-1",
      ethers.keccak256(ethers.toUtf8Bytes("my prompt")),
      "ipfs://metadata-1",
      tiers
    );
  });

  describe("Deployment", function () {
    it("Should set the correct registry address", async function () {
      expect(await license.registry()).to.equal(await registry.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await license.owner()).to.equal(owner.address);
    });
  });

  describe("purchaseCallLicense", function () {
    const CALLS = 5;

    it("Should purchase calls successfully with correct payment", async function () {
      const cost = CALL_PRICE * BigInt(CALLS);
      await license.connect(consumer).purchaseCallLicense(1, CALLS, { value: cost });
      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(CALLS);
    });

    it("Should emit CallLicensePurchased", async function () {
      const cost = CALL_PRICE * BigInt(CALLS);
      await expect(
        license.connect(consumer).purchaseCallLicense(1, CALLS, { value: cost })
      )
        .to.emit(license, "CallLicensePurchased")
        .withArgs(1n, consumer.address, CALLS, cost);
    });

    it("Should reject if prompt doesn't exist", async function () {
      const cost = CALL_PRICE * BigInt(CALLS);
      await expect(
        license.connect(consumer).purchaseCallLicense(999, CALLS, { value: cost })
      ).to.be.revertedWithCustomError(license, "PromptNotActive");
    });

    it("Should reject if PayPerCall tier is disabled", async function () {
      await registry.connect(author).setTierConfig(1, 0, CALL_PRICE, false);
      const cost = CALL_PRICE * BigInt(CALLS);
      await expect(
        license.connect(consumer).purchaseCallLicense(1, CALLS, { value: cost })
      ).to.be.revertedWithCustomError(license, "TierNotEnabled");
    });

    it("Should reject if calls = 0", async function () {
      await expect(
        license.connect(consumer).purchaseCallLicense(1, 0, { value: CALL_PRICE })
      ).to.be.revertedWithCustomError(license, "InvalidCallAmount");
    });

    it("Should reject if calls > MAX_CALLS_PER_PURCHASE", async function () {
      const calls = 10001;
      const cost = CALL_PRICE * BigInt(calls);
      await expect(
        license.connect(consumer).purchaseCallLicense(1, calls, { value: cost })
      ).to.be.revertedWithCustomError(license, "ExceedsMaxCalls");
    });

    it("Should reject if payment is insufficient", async function () {
      await expect(
        license.connect(consumer).purchaseCallLicense(1, CALLS, { value: CALL_PRICE })
      ).to.be.revertedWithCustomError(license, "InsufficientPayment");
    });

    it("Should correctly accumulate remaining calls when purchasing additional calls", async function () {
      const cost = CALL_PRICE * BigInt(CALLS);
      await license.connect(consumer).purchaseCallLicense(1, CALLS, { value: cost });
      await license.connect(consumer).purchaseCallLicense(1, CALLS, { value: cost });
      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(CALLS * 2);
    });

    it("Should credit author balance correctly", async function () {
      const cost = CALL_PRICE * BigInt(CALLS);
      await license.connect(consumer).purchaseCallLicense(1, CALLS, { value: cost });
      expect(await license.getAuthorBalance(author.address)).to.equal(cost);
    });
  });

  describe("purchaseFixedLicense", function () {
    const DURATION = 30;

    it("Should purchase fixed license successfully", async function () {
      await license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: FIXED_PRICE });
      const expiry = await license.getLicenseExpiry(1, consumer.address);
      expect(expiry).to.be.gt(0);
    });

    it("Should emit FixedLicensePurchased", async function () {
      const tx = await license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: FIXED_PRICE });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const expectedEndTime = block.timestamp + DURATION * 86400;

      await expect(tx)
        .to.emit(license, "FixedLicensePurchased")
        .withArgs(1n, consumer.address, DURATION, expectedEndTime, FIXED_PRICE);
    });

    it("Should reject if FixedLicense tier disabled", async function () {
      await registry.connect(author).setTierConfig(1, 1, FIXED_PRICE, false);
      await expect(
        license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: FIXED_PRICE })
      ).to.be.revertedWithCustomError(license, "TierNotEnabled");
    });

    it("Should reject if duration = 0", async function () {
      await expect(
        license.connect(consumer).purchaseFixedLicense(1, 0, { value: FIXED_PRICE })
      ).to.be.revertedWithCustomError(license, "InvalidDuration");
    });

    it("Should reject if duration > MAX_LICENSE_DURATION", async function () {
      await expect(
        license.connect(consumer).purchaseFixedLicense(1, 366, { value: FIXED_PRICE })
      ).to.be.revertedWithCustomError(license, "ExceedsMaxDuration");
    });

    it("Should reject if insufficient payment", async function () {
      await expect(
        license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWithCustomError(license, "InsufficientPayment");
    });

    it("Should extend existing license when purchasing again", async function () {
      await license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: FIXED_PRICE });
      const expiry1 = await license.getLicenseExpiry(1, consumer.address);

      await license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: FIXED_PRICE });
      const expiry2 = await license.getLicenseExpiry(1, consumer.address);

      expect(expiry2).to.equal(expiry1 + BigInt(DURATION * 86400));
    });

    it("Should credit author balance", async function () {
      await license.connect(consumer).purchaseFixedLicense(1, DURATION, { value: FIXED_PRICE });
      expect(await license.getAuthorBalance(author.address)).to.equal(FIXED_PRICE);
    });
  });

  describe("purchasePlaintext", function () {
    it("Should purchase plaintext successfully", async function () {
      await license.connect(consumer).purchasePlaintext(1, { value: PLAINTEXT_PRICE });
    });

    it("Should emit PlaintextPurchased", async function () {
      await expect(
        license.connect(consumer).purchasePlaintext(1, { value: PLAINTEXT_PRICE })
      )
        .to.emit(license, "PlaintextPurchased")
        .withArgs(1n, consumer.address, PLAINTEXT_PRICE);
    });

    it("Should reject if Plaintext tier disabled", async function () {
      await registry.connect(author).setTierConfig(1, 2, PLAINTEXT_PRICE, false);
      await expect(
        license.connect(consumer).purchasePlaintext(1, { value: PLAINTEXT_PRICE })
      ).to.be.revertedWithCustomError(license, "TierNotEnabled");
    });

    it("Should reject if insufficient payment", async function () {
      await expect(
        license.connect(consumer).purchasePlaintext(1, { value: ethers.parseEther("5") })
      ).to.be.revertedWithCustomError(license, "InsufficientPayment");
    });

    it("Should reject if already purchased plaintext for this prompt", async function () {
      await license.connect(consumer).purchasePlaintext(1, { value: PLAINTEXT_PRICE });
      await expect(
        license.connect(consumer).purchasePlaintext(1, { value: PLAINTEXT_PRICE })
      ).to.be.revertedWithCustomError(license, "AlreadyPurchasedPlaintext");
    });
  });

  describe("executeCall", function () {
    beforeEach(async function () {
      await license
        .connect(consumer)
        .purchaseCallLicense(1, 5, { value: CALL_PRICE * 5n });
    });

    it("Should decrement remaining calls", async function () {
      await license.connect(owner).executeCall(1, consumer.address);
      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(4);
    });

    it("Should emit CallExecuted", async function () {
      await expect(
        license.connect(owner).executeCall(1, consumer.address)
      )
        .to.emit(license, "CallExecuted")
        .withArgs(1n, consumer.address, 4);
    });

    it("Should reject if no license exists", async function () {
      await expect(
        license.connect(owner).executeCall(1, consumer2.address)
      ).to.be.revertedWithCustomError(license, "NoActiveLicense");
    });

    it("Should reject if license expired", async function () {
      await ethers.provider.send("evm_increaseTime", [366 * 86400]);
      await ethers.provider.send("evm_mine");

      await expect(
        license.connect(owner).executeCall(1, consumer.address)
      ).to.be.revertedWithCustomError(license, "LicenseExpired");
    });

    it("Should revert when calls reach 0", async function () {
      await license.connect(owner).executeCall(1, consumer.address);
      await license.connect(owner).executeCall(1, consumer.address);
      await license.connect(owner).executeCall(1, consumer.address);
      await license.connect(owner).executeCall(1, consumer.address);
      await license.connect(owner).executeCall(1, consumer.address);

      await expect(
        license.connect(owner).executeCall(1, consumer.address)
      ).to.be.revertedWithCustomError(license, "NoActiveLicense");
    });

    it("Should reject if called by non-owner", async function () {
      await expect(
        license.connect(consumer).executeCall(1, consumer.address)
      ).to.be.revertedWithCustomError(license, "OwnableUnauthorizedAccount");
    });
  });

  describe("getRemainingCalls / getLicenseExpiry", function () {
    it("Should return correct remaining calls", async function () {
      await license
        .connect(consumer)
        .purchaseCallLicense(1, 3, { value: CALL_PRICE * 3n });
      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(3);
    });

    it("Should return 0 for non-existent license", async function () {
      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(0);
      expect(await license.getLicenseExpiry(1, consumer.address)).to.equal(0);
    });

    it("Should return 0 for expired call license", async function () {
      await license
        .connect(consumer)
        .purchaseCallLicense(1, 5, { value: CALL_PRICE * 5n });

      await ethers.provider.send("evm_increaseTime", [366 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(0);
    });

    it("Should return correct expiry for fixed license", async function () {
      await license.connect(consumer).purchaseFixedLicense(1, 30, { value: FIXED_PRICE });
      const expiry = await license.getLicenseExpiry(1, consumer.address);
      expect(expiry).to.be.gt(0);

      await ethers.provider.send("evm_increaseTime", [31 * 86400]);
      await ethers.provider.send("evm_mine");

      expect(await license.getLicenseExpiry(1, consumer.address)).to.equal(0);
    });
  });

  describe("withdrawFunds", function () {
    it("Should transfer accumulated balance to author and emit FundsWithdrawn", async function () {
      await license
        .connect(consumer)
        .purchaseCallLicense(1, 5, { value: CALL_PRICE * 5n });
      const balance = await license.getAuthorBalance(author.address);

      await expect(license.connect(author).withdrawFunds())
        .to.emit(license, "FundsWithdrawn")
        .withArgs(author.address, balance);

      expect(await license.getAuthorBalance(author.address)).to.equal(0);
    });

    it("Should set balance to 0 after withdrawal", async function () {
      await license
        .connect(consumer)
        .purchaseCallLicense(1, 5, { value: CALL_PRICE * 5n });
      await license.connect(author).withdrawFunds();
      expect(await license.getAuthorBalance(author.address)).to.equal(0);
    });

    it("Should reject if no balance", async function () {
      await expect(
        license.connect(author).withdrawFunds()
      ).to.be.revertedWithCustomError(license, "NoBalanceToWithdraw");
    });
  });

  describe("claimRefund", function () {
    it("Should revert for non-owner callers", async function () {
      const key = computeKey(1, consumer.address);
      await expect(
        license.connect(consumer).claimRefund(1, key)
      ).to.be.revertedWithCustomError(license, "OwnableUnauthorizedAccount");
    });

    it("Should process call license refund correctly", async function () {
      const calls = 5;
      const cost = CALL_PRICE * BigInt(calls);
      await license.connect(consumer).purchaseCallLicense(1, calls, { value: cost });

      await license.connect(owner).executeCall(1, consumer.address);
      await license.connect(owner).executeCall(1, consumer.address);

      const key = computeKey(1, consumer.address);
      const refundAmount = CALL_PRICE * 3n;

      await expect(license.connect(owner).claimRefund(1, key))
        .to.emit(license, "RefundClaimed")
        .withArgs(1n, consumer.address, refundAmount);

      expect(await license.getRemainingCalls(1, consumer.address)).to.equal(0);
    });

    it("Should process fixed license refund correctly", async function () {
      const duration = 30;
      await license.connect(consumer).purchaseFixedLicense(1, duration, { value: FIXED_PRICE });

      await ethers.provider.send("evm_increaseTime", [10 * 86400]);
      await ethers.provider.send("evm_mine");

      const key = computeKey(1, consumer.address);

      const tx = await license.connect(owner).claimRefund(1, key);
      await expect(tx).to.emit(license, "RefundClaimed");

      expect(await license.getLicenseExpiry(1, consumer.address)).to.equal(0);
    });
  });
});
