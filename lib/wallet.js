const { createSmartAccountClient } = require('@biconomy/account');
const { WalletClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');

const bundlerUrl = process.env.BICONOMY_BUNDLER_URL;
const biconomyApiKey = process.env.BICONOMY_API_KEY;

// Privy-generated user identifier (like email or phone)
async function createSmartWallet(privyUserId) {
  // Use Privy or a generated dummy private key here (secure this!)
  const localPrivKey = process.env.DUMMY_SIGNER_KEY;
  const account = privateKeyToAccount(`0x${localPrivKey}`);

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  const smartAccountClient = await createSmartAccountClient({
    signer: walletClient,
    chainId: base.id,
    bundlerUrl,
    biconomy: {
      apiKey: biconomyApiKey,
    },
  });

  const smartAddress = await smartAccountClient.getAccountAddress();
  return { smartAccountClient, smartAddress };
}

// Add the missing function that index.js is trying to import
async function createOrGetWallet(userId) {
  const { smartAccountClient, smartAddress } = await createSmartWallet(userId);
  return {
    wallet: smartAccountClient,
    smartAccount: { address: smartAddress }
  };
}

module.exports = { createSmartWallet, createOrGetWallet };
