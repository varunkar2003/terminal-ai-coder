// Blockchain tools — interact with Ethereum and other chains via RPC

const DEFAULT_RPC = {
  ethereum: 'https://eth.llamarpc.com',
  polygon: 'https://polygon-rpc.com',
  bsc: 'https://bsc-dataseed.binance.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  base: 'https://mainnet.base.org',
};

async function rpcCall(rpcUrl, method, params = []) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) throw new Error(`RPC error: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

function hexToDecimal(hex) {
  return parseInt(hex, 16);
}

function weiToEth(weiHex) {
  const wei = BigInt(weiHex);
  const eth = Number(wei) / 1e18;
  return eth.toFixed(6);
}

export async function getBalance(address, chain = 'ethereum') {
  const rpcUrl = DEFAULT_RPC[chain] || DEFAULT_RPC.ethereum;
  const balance = await rpcCall(rpcUrl, 'eth_getBalance', [address, 'latest']);
  const eth = weiToEth(balance);
  return `Balance of ${address} on ${chain}: ${eth} ETH`;
}

export async function getBlockNumber(chain = 'ethereum') {
  const rpcUrl = DEFAULT_RPC[chain] || DEFAULT_RPC.ethereum;
  const block = await rpcCall(rpcUrl, 'eth_blockNumber');
  return `Latest block on ${chain}: ${hexToDecimal(block)}`;
}

export async function getTransaction(txHash, chain = 'ethereum') {
  const rpcUrl = DEFAULT_RPC[chain] || DEFAULT_RPC.ethereum;
  const tx = await rpcCall(rpcUrl, 'eth_getTransactionByHash', [txHash]);
  if (!tx) return `Transaction not found: ${txHash}`;

  return [
    `Transaction: ${txHash}`,
    `From: ${tx.from}`,
    `To: ${tx.to || '(contract creation)'}`,
    `Value: ${weiToEth(tx.value)} ETH`,
    `Block: ${tx.blockNumber ? hexToDecimal(tx.blockNumber) : 'pending'}`,
    `Gas: ${hexToDecimal(tx.gas)}`,
  ].join('\n');
}

export async function getGasPrice(chain = 'ethereum') {
  const rpcUrl = DEFAULT_RPC[chain] || DEFAULT_RPC.ethereum;
  const gasPrice = await rpcCall(rpcUrl, 'eth_gasPrice');
  const gwei = Number(BigInt(gasPrice)) / 1e9;
  return `Gas price on ${chain}: ${gwei.toFixed(2)} Gwei`;
}

export function getSupportedChains() {
  return Object.keys(DEFAULT_RPC).map(c => `- ${c}: ${DEFAULT_RPC[c]}`).join('\n');
}
