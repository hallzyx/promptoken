const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy PromptRegistry with deployer as initial owner
  const PromptRegistry = await hre.ethers.getContractFactory("PromptRegistry");
  const registry = await PromptRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("PromptRegistry deployed to:", registryAddress);

  // Deploy PromptLicense with registry address
  const PromptLicense = await hre.ethers.getContractFactory("PromptLicense");
  const license = await PromptLicense.deploy(registryAddress);
  await license.waitForDeployment();
  const licenseAddress = await license.getAddress();
  console.log("PromptLicense deployed to:", licenseAddress);

  // Deploy PromptGovernance with owner, registry, and license addresses
  const PromptGovernance = await hre.ethers.getContractFactory("PromptGovernance");
  const governance = await PromptGovernance.deploy(deployer.address, registryAddress, licenseAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("PromptGovernance deployed to:", governanceAddress);

  // Set governance address in registry (onlyOwner function)
  const setGovTx = await registry.setGovernance(governanceAddress);
  await setGovTx.wait();
  console.log("Governance address set in PromptRegistry");

  console.log("\n=== Deployment Summary ===");
  console.log("PromptRegistry:", registryAddress);
  console.log("PromptLicense:", licenseAddress);
  console.log("PromptGovernance:", governanceAddress);

  const fs = require("fs");
  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      PromptRegistry: registryAddress,
      PromptLicense: licenseAddress,
      PromptGovernance: governanceAddress,
    },
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
  console.log("Deployment info saved to deployment.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
