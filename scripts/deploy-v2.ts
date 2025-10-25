import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying SalaryStreamV2 contract...");

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }

  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying from address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Read contract artifacts
  const artifactPath = path.join(__dirname, "../artifacts/contracts/SalaryStreamV2.sol/SalaryStreamV2.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Deploy contract
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ SalaryStreamV2 deployed to:", address);
  console.log("Transaction hash:", contract.deploymentTransaction()?.hash);
  console.log("View on BaseScan:", `https://basescan.org/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
