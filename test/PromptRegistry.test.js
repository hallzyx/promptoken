const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PromptRegistry", function () {
  let registry;
  let owner, author, user, governance;

  const storageHash = "QmTest123";
  const promptHash = ethers.keccak256(ethers.toUtf8Bytes("test prompt"));
  const metadataURI = "https://example.com/metadata.json";

  const defaultTiers = [
    { price: ethers.parseEther("0.01"), enabled: true },
    { price: ethers.parseEther("0.1"), enabled: true },
    { price: ethers.parseEther("1"), enabled: true },
  ];

  beforeEach(async function () {
    [owner, author, user, governance] = await ethers.getSigners();
    const PromptRegistry = await ethers.getContractFactory("PromptRegistry");
    registry = await PromptRegistry.deploy(owner.address);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should start with prompt ID counter at 1", async function () {
      const promptId = await registry.registerPrompt.staticCall(
        storageHash,
        promptHash,
        metadataURI,
        defaultTiers
      );
      expect(promptId).to.equal(1n);
    });

    it("Should start unpaused", async function () {
      expect(await registry.paused()).to.be.false;
    });

    it("Should have zero author count for any address", async function () {
      expect(await registry.getAuthorPromptCount(owner.address)).to.equal(0n);
      expect(await registry.getAuthorPromptCount(author.address)).to.equal(0n);
    });
  });

  describe("registerPrompt", function () {
    it("Should register a prompt successfully with valid tiers", async function () {
      const tx = await registry.connect(author).registerPrompt(
        storageHash,
        promptHash,
        metadataURI,
        defaultTiers
      );

      const prompt = await registry.getPrompt(1);
      expect(prompt.author).to.equal(author.address);
      expect(prompt.promptHash).to.equal(promptHash);
      expect(prompt.metadataURI).to.equal(metadataURI);
      expect(prompt.active).to.be.true;
      expect(prompt.createdAt).to.be.gt(0);
    });

    it("Should emit PromptRegistered and VersionPublished events", async function () {
      const tx = await registry.connect(author).registerPrompt(
        storageHash,
        promptHash,
        metadataURI,
        defaultTiers
      );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(registry, "PromptRegistered")
        .withArgs(1n, author.address, promptHash, block.timestamp);

      await expect(tx)
        .to.emit(registry, "VersionPublished")
        .withArgs(1n, 1n, storageHash, block.timestamp);
    });

    it("Should reject empty tiers array", async function () {
      await expect(
        registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, [])
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__InvalidTierConfig");
    });

    it("Should reject empty storageHash", async function () {
      await expect(
        registry.connect(author).registerPrompt("", promptHash, metadataURI, defaultTiers)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__InvalidStorageHash");
    });

    it("Should reject zero promptHash", async function () {
      await expect(
        registry.connect(author).registerPrompt(
          storageHash,
          ethers.ZeroHash,
          metadataURI,
          defaultTiers
        )
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__InvalidPromptHash");
    });

    it("Should reject if paused", async function () {
      await registry.pause();
      await expect(
        registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });

    it("Should store correct author as msg.sender", async function () {
      const tx = await registry.connect(author).registerPrompt(
        storageHash,
        promptHash,
        metadataURI,
        defaultTiers
      );
      const prompt = await registry.getPrompt(1);
      expect(prompt.author).to.equal(author.address);
    });

    it("Should increment prompt IDs sequentially", async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);

      expect(await registry.getAuthorPromptCount(author.address)).to.equal(3n);
    });

    it("Should create initial version with versionNumber 1", async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);

      const version = await registry.getVersion(1, 0);
      expect(version.versionNumber).to.equal(1n);
    });

    it("Should accept 1-tier config (non-strict on length)", async function () {
      const singleTier = [{ price: ethers.parseEther("0.05"), enabled: true }];
      const tx = await registry.connect(author).registerPrompt(
        storageHash, promptHash, metadataURI, singleTier
      );
      const tier = await registry.getTierConfig(1, 0);
      expect(tier.price).to.equal(ethers.parseEther("0.05"));
      expect(tier.enabled).to.be.true;
    });
  });

  describe("publishVersion", function () {
    const newStorageHash = "QmNewVersion";

    beforeEach(async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
    });

    it("Should publish a new version", async function () {
      await registry.connect(author).publishVersion(1, newStorageHash);
      expect(await registry.getVersionCount(1)).to.equal(2n);
    });

    it("Should increment version number", async function () {
      await registry.connect(author).publishVersion(1, newStorageHash);
      const version = await registry.getVersion(1, 1);
      expect(version.versionNumber).to.equal(2n);
    });

    it("Should emit VersionPublished", async function () {
      const tx = await registry.connect(author).publishVersion(1, newStorageHash);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(registry, "VersionPublished")
        .withArgs(1n, 2n, newStorageHash, block.timestamp);
    });

    it("Should reject if not called by author", async function () {
      await expect(
        registry.connect(user).publishVersion(1, newStorageHash)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__NotAuthor");
    });

    it("Should reject if prompt does not exist", async function () {
      await expect(
        registry.connect(author).publishVersion(999, newStorageHash)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__NotAuthor");
    });

    it("Should reject if prompt is deactivated", async function () {
      await registry.connect(author).deactivatePrompt(1);
      await expect(
        registry.connect(author).publishVersion(1, newStorageHash)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__PromptDeactivated");
    });

    it("Should reject empty storageHash", async function () {
      await expect(
        registry.connect(author).publishVersion(1, "")
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__InvalidStorageHash");
    });

    it("Should reject if paused", async function () {
      await registry.pause();
      await expect(
        registry.connect(author).publishVersion(1, newStorageHash)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });

    it("Should allow multiple version publications", async function () {
      await registry.connect(author).publishVersion(1, "v2");
      await registry.connect(author).publishVersion(1, "v3");
      await registry.connect(author).publishVersion(1, "v4");
      expect(await registry.getVersionCount(1)).to.equal(4n);
    });
  });

  describe("setTierConfig", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
    });

    it("Should update tier price and enabled status", async function () {
      await registry.connect(author).setTierConfig(1, 0, ethers.parseEther("0.02"), false);
      const tier = await registry.getTierConfig(1, 0);
      expect(tier.price).to.equal(ethers.parseEther("0.02"));
      expect(tier.enabled).to.be.false;
    });

    it("Should emit TierConfigUpdated", async function () {
      const tx = await registry.connect(author).setTierConfig(1, 1, ethers.parseEther("0.5"), true);
      await expect(tx)
        .to.emit(registry, "TierConfigUpdated")
        .withArgs(1n, 1, ethers.parseEther("0.5"), true);
    });

    it("Should reject if not called by author", async function () {
      await expect(
        registry.connect(user).setTierConfig(1, 0, ethers.parseEther("0.05"), true)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__NotAuthor");
    });

    it("Should reject if paused", async function () {
      await registry.pause();
      await expect(
        registry.connect(author).setTierConfig(1, 0, ethers.parseEther("0.05"), true)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });

    it("Should update each tier independently", async function () {
      await registry.connect(author).setTierConfig(1, 0, ethers.parseEther("0.03"), true);
      await registry.connect(author).setTierConfig(1, 1, ethers.parseEther("0.2"), false);
      await registry.connect(author).setTierConfig(1, 2, ethers.parseEther("2"), true);

      expect((await registry.getTierConfig(1, 0)).price).to.equal(ethers.parseEther("0.03"));
      expect((await registry.getTierConfig(1, 1)).price).to.equal(ethers.parseEther("0.2"));
      expect((await registry.getTierConfig(1, 2)).price).to.equal(ethers.parseEther("2"));
    });
  });

  describe("deactivatePrompt", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
    });

    it("Should deactivate a prompt", async function () {
      await registry.connect(author).deactivatePrompt(1);
      expect(await registry.isPromptActive(1)).to.be.false;
    });

    it("Should emit PromptDeactivated", async function () {
      const tx = await registry.connect(author).deactivatePrompt(1);
      await expect(tx).to.emit(registry, "PromptDeactivated").withArgs(1n);
    });

    it("Should reject if not called by author", async function () {
      await expect(
        registry.connect(user).deactivatePrompt(1)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__NotAuthor");
    });

    it("Should reject if paused", async function () {
      await registry.pause();
      await expect(
        registry.connect(author).deactivatePrompt(1)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });

    it("Should be idempotent (deactivating twice is allowed)", async function () {
      await registry.connect(author).deactivatePrompt(1);
      await registry.connect(author).deactivatePrompt(1);
      expect(await registry.isPromptActive(1)).to.be.false;
    });
  });

  describe("getPrompt / getVersion / getVersionCount", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
    });

    it("Should return correct prompt data", async function () {
      const prompt = await registry.getPrompt(1);
      expect(prompt.author).to.equal(author.address);
      expect(prompt.promptHash).to.equal(promptHash);
      expect(prompt.metadataURI).to.equal(metadataURI);
      expect(prompt.active).to.be.true;
      expect(prompt.createdAt).to.be.gt(0);
    });

    it("Should return correct version data (0-indexed)", async function () {
      const version = await registry.getVersion(1, 0);
      expect(version.versionNumber).to.equal(1n);
      expect(version.timestamp).to.be.gt(0);
    });

    it("Should revert for non-existent prompt in getPrompt", async function () {
      await expect(
        registry.getPrompt(999)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__PromptNotFound");
    });

    it("Should revert for out-of-range version index", async function () {
      await expect(
        registry.getVersion(1, 999)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__VersionNotFound");
    });

    it("Should revert for non-existent prompt in getVersion", async function () {
      await expect(
        registry.getVersion(999, 0)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__PromptNotFound");
    });

    it("Should return correct version count", async function () {
      expect(await registry.getVersionCount(1)).to.equal(1n);
      await registry.connect(author).publishVersion(1, "v2");
      expect(await registry.getVersionCount(1)).to.equal(2n);
    });

    it("Should revert getVersionCount for non-existent prompt", async function () {
      await expect(
        registry.getVersionCount(999)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__PromptNotFound");
    });
  });

  describe("getAuthorPromptCount / getPromptIdByIndex", function () {
    it("Should return correct count per author", async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.connect(user).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);

      expect(await registry.getAuthorPromptCount(author.address)).to.equal(2n);
      expect(await registry.getAuthorPromptCount(user.address)).to.equal(1n);
    });

    it("Should return prompt IDs by index", async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);

      expect(await registry.getPromptIdByIndex(author.address, 0)).to.equal(1n);
      expect(await registry.getPromptIdByIndex(author.address, 1)).to.equal(2n);
    });

    it("Should revert for out-of-bounds index", async function () {
      await expect(
        registry.getPromptIdByIndex(author.address, 0)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__IndexOutOfBounds");
    });

    it("Should return 0 count for unknown address", async function () {
      expect(await registry.getAuthorPromptCount(user.address)).to.equal(0n);
    });
  });

  describe("getTierConfig", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
    });

    it("Should return enabled tier with correct price", async function () {
      const tier = await registry.getTierConfig(1, 0);
      expect(tier.price).to.equal(defaultTiers[0].price);
      expect(tier.enabled).to.be.true;
    });

    it("Should return disabled tier", async function () {
      await registry.connect(author).setTierConfig(1, 1, ethers.parseEther("0.5"), false);
      const tier = await registry.getTierConfig(1, 1);
      expect(tier.enabled).to.be.false;
      expect(tier.price).to.equal(ethers.parseEther("0.5"));
    });

    it("Should revert for non-existent prompt", async function () {
      await expect(
        registry.getTierConfig(999, 0)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__PromptNotFound");
    });
  });

  describe("isPromptActive", function () {
    it("Should return false for non-existent prompt", async function () {
      expect(await registry.isPromptActive(999)).to.be.false;
    });

    it("Should return true for active prompt", async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      expect(await registry.isPromptActive(1)).to.be.true;
    });

    it("Should return false after deactivation", async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.connect(author).deactivatePrompt(1);
      expect(await registry.isPromptActive(1)).to.be.false;
    });
  });

  describe("Pause / Unpause", function () {
    it("Should allow owner to pause", async function () {
      await registry.pause();
      expect(await registry.paused()).to.be.true;
    });

    it("Should allow owner to unpause", async function () {
      await registry.pause();
      await registry.unpause();
      expect(await registry.paused()).to.be.false;
    });

    it("Should reject pause from non-owner", async function () {
      await expect(
        registry.connect(user).pause()
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("setGovernance", function () {
    it("Should set governance address (owner only)", async function () {
      await registry.setGovernance(governance.address);
    });

    it("Should reject if not owner", async function () {
      await expect(
        registry.connect(author).setGovernance(governance.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("transferCustody", function () {
    beforeEach(async function () {
      await registry.connect(author).registerPrompt(storageHash, promptHash, metadataURI, defaultTiers);
      await registry.setGovernance(governance.address);
    });

    it("Should transfer custody via governance", async function () {
      const newCustodian = user.address;
      await registry.connect(governance).transferCustody(1, newCustodian);

      const prompt = await registry.getPrompt(1);
      expect(prompt.author).to.equal(newCustodian);
    });

    it("Should emit PromptCustodyTransferred", async function () {
      const newCustodian = user.address;
      const tx = await registry.connect(governance).transferCustody(1, newCustodian);

      await expect(tx)
        .to.emit(registry, "PromptCustodyTransferred")
        .withArgs(1n, author.address, newCustodian);
    });

    it("Should reject if not governance", async function () {
      await expect(
        registry.connect(author).transferCustody(1, user.address)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__NotGovernance");
    });

    it("Should reject zero address custodian", async function () {
      await expect(
        registry.connect(governance).transferCustody(1, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__InvalidCustodian");
    });

    it("Should reject for non-existent prompt", async function () {
      await expect(
        registry.connect(governance).transferCustody(999, user.address)
      ).to.be.revertedWithCustomError(registry, "PromptRegistry__PromptNotFound");
    });

    it("Should update author prompt tracking on transfer", async function () {
      expect(await registry.getAuthorPromptCount(author.address)).to.equal(1n);
      expect(await registry.getAuthorPromptCount(user.address)).to.equal(0n);

      await registry.connect(governance).transferCustody(1, user.address);

      expect(await registry.getAuthorPromptCount(author.address)).to.equal(0n);
      expect(await registry.getAuthorPromptCount(user.address)).to.equal(1n);
    });

    it("Should allow querying transferred prompt by new author index", async function () {
      await registry.connect(governance).transferCustody(1, user.address);
      expect(await registry.getPromptIdByIndex(user.address, 0)).to.equal(1n);
    });
  });
});
