const { ethers } = require('ethers');
const { getSmartAccountClient } = require('./wallet');
const ERC20_ABI = require('./abis/erc20.json');
const ESCROW_ABI = require('./abis/escrow.json');

// ENV
const RPC_URL = process.env.RPC_URL;
const ESCROW_CONTRACT = process.env.ESCROW_CONTRACT;
const USDC_ADDRESS = process.env.USDC_ADDRESS;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

async function sendETH({ address, amount, userId }) {
  const client = await getSmartAccountClient(userId);
  const tx = {
    to: address,
    value: ethers.utils.parseEther(amount.toString())
  };
  return await client.sendTransaction(tx);
}

async function sendUSDC({ address, amount, userId }) {
  const client = await getSmartAccountClient(userId);
  const contract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const decimals = await contract.decimals();
  const parsedAmount = ethers.utils.parseUnits(amount.toString(), decimals);

  const tx = {
    to: USDC_ADDRESS,
    data: contract.interface.encodeFunctionData("transfer", [address, parsedAmount])
  };
  return await client.sendTransaction(tx);
}

async function checkBalance(userId) {
  const client = await getSmartAccountClient(userId);
  const address = await client.getAddress();

  const ethBal = await provider.getBalance(address);
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const usdcBal = await usdcContract.balanceOf(address);
  const usdcDecimals = await usdcContract.decimals();

  return {
    address,
    eth: parseFloat(ethers.utils.formatEther(ethBal)).toFixed(5),
    usdc: parseFloat(ethers.utils.formatUnits(usdcBal, usdcDecimals)).toFixed(2)
  };
}

// Escrow
async function lockEscrow({ senderId, receiver, amount }) {
  const client = await getSmartAccountClient(senderId);
  const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, provider);
  const iface = new ethers.utils.Interface(ESCROW_ABI);
  const parsed = ethers.utils.parseEther(amount.toString());

  const tx = {
    to: ESCROW_CONTRACT,
    data: iface.encodeFunctionData("lock", [receiver, parsed])
  };

  return await client.sendTransaction(tx);
}

async function releaseEscrow({ senderId, receiver }) {
  const client = await getSmartAccountClient(senderId);
  const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, provider);
  const iface = new ethers.utils.Interface(ESCROW_ABI);

  const tx = {
    to: ESCROW_CONTRACT,
    data: iface.encodeFunctionData("release", [receiver])
  };

  return await client.sendTransaction(tx);
}

async function refundEscrow({ senderId, receiver }) {
  const client = await getSmartAccountClient(senderId);
  const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, provider);
  const iface = new ethers.utils.Interface(ESCROW_ABI);

  const tx = {
    to: ESCROW_CONTRACT,
    data: iface.encodeFunctionData("refund", [receiver])
  };

  return await client.sendTransaction(tx);
}

// Group Tip
async function groupTip({ senderId, receivers, amount }) {
  const splitAmount = (amount / receivers.length).toFixed(6);
  const results = [];

  for (const receiver of receivers) {
    const tx = await sendETH({ address: receiver, amount: splitAmount, userId: senderId });
    results.push(tx);
  }

  return results;
}

// Rain
async function rainDrop({ senderId, groupAddresses, amount }) {
  const randomIndex = Math.floor(Math.random() * groupAddresses.length);
  const lucky = groupAddresses[randomIndex];

  const tx = await sendETH({ address: lucky, amount, userId: senderId });
  return { lucky, tx };
}

module.exports = {
  sendETH,
  sendUSDC,
  checkBalance,
  lockEscrow,
  releaseEscrow,
  refundEscrow,
  groupTip,
  rainDrop
};
