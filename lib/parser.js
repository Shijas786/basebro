const parseMessage = (message) => {
  message = message.toLowerCase();

  if (message.includes("create wallet")) {
    return { type: "create_wallet" };
  }

  if (message.includes("balance")) {
    return { type: "check_balance" };
  }

  const sendMatch = message.match(/send (\d+\.?\d*) (eth|usdc) to (0x[a-f0-9]{40})/);
  if (sendMatch) {
    return {
      type: "send_token",
      amount: parseFloat(sendMatch[1]),
      token: sendMatch[2].toLowerCase(),
      to: sendMatch[3],
    };
  }

  const escrowMatch = message.match(/escrow (\d+\.?\d*) (eth|usdc) to (0x[a-f0-9]{40})/);
  if (escrowMatch) {
    return {
      type: "start_escrow",
      amount: parseFloat(escrowMatch[1]),
      token: escrowMatch[2].toLowerCase(),
      to: escrowMatch[3],
    };
  }

  if (message.startsWith("tip group")) {
    return { type: "group_tip" };
  }

  if (message.startsWith("rain group")) {
    return { type: "group_rain" };
  }

  if (message.startsWith("history")) {
    return { type: "history" };
  }

  return { type: "unknown" };
};

module.exports = { parseMessage };
