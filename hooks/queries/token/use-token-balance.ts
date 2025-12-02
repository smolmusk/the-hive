import useSWR from 'swr';
import { useChain } from '@/app/_contexts/chain-context';
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export const useTokenBalance = (tokenAddress: string, walletAddress: string) => {
  const { currentChain: chain } = useChain();

  const { data, isLoading } = useSWR<number>(
    tokenAddress && walletAddress
      ? `token-balance-${chain}-${tokenAddress}-${walletAddress}`
      : null,
    async () => {
      if (chain === 'solana') {
        const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
        if (tokenAddress === 'So11111111111111111111111111111111111111112') {
          const balance =
            (await connection.getBalance(new PublicKey(walletAddress))) / LAMPORTS_PER_SOL;
          return balance;
        } else {
          const mint = new PublicKey(tokenAddress);
          const owner = new PublicKey(walletAddress);

          const getBalanceForProgram = async (programId: PublicKey) => {
            const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
            try {
              const tokenAccount = await connection.getTokenAccountBalance(ata);
              console.log('✅ Successfully fetched token balance:', tokenAccount.value.uiAmount);
              return tokenAccount.value.uiAmount ?? 0;
            } catch (err) {
              return null; // fall through to next strategy
            }
          };

          // Try Token-2022, then classic SPL ATA
          const token2022Balance = await getBalanceForProgram(TOKEN_2022_PROGRAM_ID);
          if (token2022Balance !== null) return token2022Balance;

          const splBalance = await getBalanceForProgram(TOKEN_PROGRAM_ID);
          if (splBalance !== null) return splBalance;

          // Fallback: search any token accounts by owner and mint (covers non-ATA accounts)
          try {
            const [tokenProgramAccounts, token2022ProgramAccounts] = await Promise.all([
              connection.getParsedTokenAccountsByOwner(owner, {
                mint,
                programId: TOKEN_PROGRAM_ID,
              }),
              connection.getParsedTokenAccountsByOwner(owner, {
                mint,
                programId: TOKEN_2022_PROGRAM_ID,
              }),
            ]);

            const accounts = [...tokenProgramAccounts.value, ...token2022ProgramAccounts.value];

            const total = accounts.reduce((acc, accountInfo) => {
              const parsed = accountInfo.account.data;
              const amount = parsed?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
              return acc + (amount || 0);
            }, 0);

            if (total > 0) {
              console.log('✅ Fallback fetched token balance via parsed accounts:', total);
            }
            return total;
          } catch (error) {
            console.error('❌ Error getting token account balance via parsed accounts:', error);
            return 0;
          }
        }
      } else {
        const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_BSC_RPC_URL);
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
          const balance = await provider.getBalance(walletAddress);
          return Number(ethers.formatEther(balance));
        } else {
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          const [balance, decimals] = await Promise.all([
            contract.balanceOf(walletAddress),
            contract.decimals(),
          ]);
          return Number(ethers.formatUnits(balance, decimals));
        }
      }
    },
  );

  return {
    balance: data || 0,
    isLoading,
  };
};
