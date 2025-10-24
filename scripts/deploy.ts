import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("Deploying SalaryStream contract...");

  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const wallet = new ethers.Wallet("0xd82e86acc118255d0691898138eb48e77cc6da0eebd18337f748e3f5b2741ca7", provider);

  console.log("Deploying from address:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Read contract artifacts
  const artifactPath = path.join(__dirname, "../artifacts/contracts/SalaryStream.sol/SalaryStream.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Deploy contract
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ SalaryStream deployed to:", address);
  console.log("Transaction hash:", contract.deploymentTransaction()?.hash);
  console.log("View on BaseScan:", `https://basescan.org/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
