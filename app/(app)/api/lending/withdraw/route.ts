import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  VersionedMessage,
  TransactionInstruction,
} from '@solana/web3.js';
import BN from 'bn.js';
import { NextRequest, NextResponse } from 'next/server';

// Kamino SDK
import {
  KaminoMarket,
  KaminoAction,
  DEFAULT_RECENT_SLOT_DURATION_MS,
} from '@kamino-finance/klend-sdk';
import {
  createSolanaRpc,
  address as createAddress,
  Instruction,
  type Address,
  type Rpc,
} from '@solana/kit';

const LOOPSCALE_BASE_URL = process.env.LOOPSCALE_BASE_URL || 'https://tars.loopscale.com/v1';
const KAMINO_MAIN_MARKET = new PublicKey('7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF');
const KAMINO_PROGRAM_ID = new PublicKey('KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD');

/**
 * POST /api/lending/withdraw
 *
 * Build a withdraw transaction on the server side (required for SDKs with Node.js dependencies)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      protocol,
      tokenMint,
      tokenSymbol,
      amount,
      walletAddress,
      protocolAddress,
      withdrawAll,
    } = body;

    if (!protocol || !tokenMint || !tokenSymbol || (!amount && !withdrawAll) || !walletAddress) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: protocol, tokenMint, tokenSymbol, walletAddress, and either amount or withdrawAll',
        },
        { status: 400 },
      );
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
    const wallet = new PublicKey(walletAddress);

    let transaction: VersionedTransaction;

    switch (protocol.toLowerCase()) {
      case 'kamino-lend':
      case 'kamino':
      case 'jupiter-lend':
      case 'jup-lend':
        transaction = await buildKaminoWithdrawTx(
          connection,
          wallet,
          tokenMint,
          tokenSymbol,
          amount || 0,
        );
        break;
      case 'loopscale':
      case 'loopscale-lend':
      case 'loopscale-vault':
        transaction = await buildLoopscaleWithdrawTx(
          wallet,
          tokenSymbol,
          amount || 0,
          protocolAddress,
          withdrawAll,
        );
        break;
      default:
        return NextResponse.json({ error: `Unsupported protocol: ${protocol}` }, { status: 400 });
    }

    // Serialize transaction to base64 for client
    const serialized = Buffer.from(transaction.serialize()).toString('base64');

    return NextResponse.json({
      transaction: serialized,
      protocol,
    });
  } catch (error: any) {
    console.error('Error building withdraw transaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to build withdraw transaction' },
      { status: 500 },
    );
  }
}

/**
 * Loopscale - Vault Withdraw
 */
async function buildLoopscaleWithdrawTx(
  wallet: PublicKey,
  tokenSymbol: string,
  amount: number,
  vaultAddress?: string,
  withdrawAll?: boolean,
): Promise<VersionedTransaction> {
  try {
    if (!vaultAddress) {
      throw new Error('Loopscale vault address is required (pass via protocolAddress)');
    }

    const decimals = tokenSymbol.toUpperCase() === 'SOL' ? 9 : 6;
    const amountPrincipal = Math.floor(amount * Math.pow(10, decimals));

    const response = await fetch(`${LOOPSCALE_BASE_URL}/markets/lending_vaults/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-wallet': wallet.toBase58(),
      },
      body: JSON.stringify({
        amountPrincipal,
        maxAmountLp: amountPrincipal || 0,
        vault: vaultAddress,
        withdrawAll: !!withdrawAll,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Loopscale withdraw failed: ${response.status} ${text || 'Unknown error'}`);
    }

    const data = await response.json();
    const messageB64 = data?.transaction?.message;
    if (!messageB64) {
      throw new Error('Loopscale response missing transaction.message');
    }

    const message = VersionedMessage.deserialize(Buffer.from(messageB64, 'base64'));
    const tx = new VersionedTransaction(message);

    return tx;
  } catch (err: any) {
    console.error('❌ Error building Loopscale withdraw transaction:', err);
    throw new Error(`Failed to build Loopscale withdraw transaction: ${err.message || err}`);
  }
}

/**
 * Build withdraw transaction for Kamino protocol
 */
async function buildKaminoWithdrawTx(
  connection: Connection,
  wallet: PublicKey,
  tokenMint: string,
  tokenSymbol: string,
  amount: number,
): Promise<VersionedTransaction> {
  try {
    // Create Kamino-compatible RPC and addresses
    const kaminoRpc: Rpc<any> = createSolanaRpc(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
    const marketAddress: Address = createAddress(KAMINO_MAIN_MARKET.toBase58());
    const programId: Address = createAddress(KAMINO_PROGRAM_ID.toBase58());
    const walletAddress: Address = createAddress(wallet.toBase58());

    // Load Kamino market
    const market = await KaminoMarket.load(
      kaminoRpc,
      marketAddress,
      DEFAULT_RECENT_SLOT_DURATION_MS,
      programId,
    );

    if (!market) {
      throw new Error('Failed to load Kamino market');
    }

    // Find the reserve for this token mint
    let targetReserve = null;
    for (const reserve of market.reserves.values()) {
      const reserveMint = reserve.state?.liquidity?.mintPubkey?.toString();
      if (reserveMint === tokenMint || reserve.symbol.toUpperCase() === tokenSymbol.toUpperCase()) {
        targetReserve = reserve;
        break;
      }
    }

    if (!targetReserve) {
      throw new Error(
        `Reserve not found for token ${tokenSymbol} (${tokenMint}) in Kamino market. Available reserves: ${Array.from(
          market.reserves.values(),
        )
          .map((r) => r.symbol)
          .join(', ')}`,
      );
    }

    // Get the mint address from the reserve (this is the source of truth)
    const tokenMintAddress = targetReserve.state?.liquidity?.mintPubkey?.toString() ?? tokenMint;
    if (!tokenMintAddress) {
      throw new Error(`Could not get mint address from reserve for ${tokenSymbol}`);
    }

    // Use the mint address from the reserve, not from the position data
    const mintAddress: Address = createAddress(tokenMintAddress);

    // Convert amount to base units (lamports/smallest unit)
    const decimals =
      targetReserve.state?.liquidity?.mintDecimals?.toNumber() ||
      (tokenSymbol.toUpperCase() === 'SOL' ? 9 : 6);
    const amountBase = Math.floor(amount * Math.pow(10, decimals));

    // Create a transaction signer for Kamino SDK
    const signer: any = {
      address: walletAddress,
      signTransactions: async (txs: any) => txs,
    };

    // Get user's obligation (required for withdraw)
    const userAddressForObligation: Address = createAddress(wallet.toBase58());
    let obligation: any;

    try {
      obligation = await market.getUserVanillaObligation(userAddressForObligation);
    } catch {
      throw new Error(
        'User does not have an obligation account. Cannot withdraw without a lending position.',
      );
    }

    // Get current slot
    const currentSlot = await connection.getSlot();

    // Build withdraw action
    const withdrawAction = await KaminoAction.buildWithdrawTxns(
      market,
      new BN(amountBase),
      mintAddress,
      signer,
      obligation,
      true, // useV2Ixs
      undefined, // scopeRefreshConfig
      undefined, // extraComputeBudget
      undefined, // includeAtaIxs
      undefined, // requestElevationGroup
      {
        skipInitialization: true, // User already has obligation
        skipLutCreation: true, // Skip Address Lookup Table creation
      },
      undefined, // referrer
      BigInt(currentSlot), // currentSlot
    );

    // Get all instructions from the action
    const allInstructions = [
      ...(withdrawAction.setupIxs || []),
      ...withdrawAction.lendingIxs,
      ...(withdrawAction.cleanupIxs || []),
    ] as any;

    // Convert Kamino instructions to legacy TransactionInstructions
    const legacyInstructions = allInstructions.map((instruction: any) =>
      convertKaminoInstructionToLegacy(instruction),
    );

    // Build the transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: wallet,
      recentBlockhash: blockhash,
      instructions: legacyInstructions,
    }).compileToV0Message();

    const versionedTx = new VersionedTransaction(messageV0);

    return versionedTx;
  } catch (err: any) {
    console.error('❌ Error building Kamino withdraw transaction:', err);
    throw new Error(`Failed to build Kamino withdraw transaction: ${err.message}`);
  }
}

/**
 * Helper function to convert Kamino SDK instruction format to legacy TransactionInstruction
 */
function convertKaminoInstructionToLegacy(instruction: Instruction): TransactionInstruction {
  if (!instruction.accounts || !instruction.data) {
    throw new Error('Instruction missing required accounts or data');
  }

  return new TransactionInstruction({
    programId: new PublicKey(instruction.programAddress),
    keys: instruction.accounts.map((account: any) => {
      // 0 = read-only
      // 1 = writable (bit 0)
      // 2 = signer (bit 1)
      // 3 = signer + writable (bits 0 and 1)
      const role = typeof account.role === 'number' ? account.role : 0;
      const isWritable = (role & 1) !== 0; // Check bit 0
      const isSigner = (role & 2) !== 0; // Check bit 1

      return {
        pubkey: new PublicKey(account.address),
        isSigner,
        isWritable,
      };
    }),
    data: Buffer.from(instruction.data),
  });
}
