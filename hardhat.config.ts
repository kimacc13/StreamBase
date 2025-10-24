import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    baseSepolia: {
      type: "http" as const,
      url: "https://sepolia.base.org",
      accounts: ["0xd82e86acc118255d0691898138eb48e77cc6da0eebd18337f748e3f5b2741ca7"],
      chainId: 84532,
    },
    baseMainnet: {
      type: "http" as const,
      url: "https://mainnet.base.org",
      accounts: ["0xd82e86acc118255d0691898138eb48e77cc6da0eebd18337f748e3f5b2741ca7"],
      chainId: 8453,
    },
  },
};

export default config;
