import { 
    Keypair, 
    Connection, 
    PublicKey, 
    SystemProgram, 
    LAMPORTS_PER_SOL,
    Transaction,
    sendAndConfirmTransaction,
    VersionedTransaction
} from "@solana/web3.js";
import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { 
    TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createAssociatedTokenAccountInstruction, 
    createSyncNativeInstruction, 
    createApproveInstruction 
} from "@solana/spl-token";
import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';

// Constants
const PERPETUALS_PROGRAM_ID = new PublicKey("J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS");
const POOL_PUBKEY = new PublicKey("4oeCDy1bksQPCaPpUYkhQo9DihqWNAecchcwJLnKo6E7");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

class PerpsPositionManager {
    private connection: Connection;
    private wallet: Keypair;
    private program: Program;
    private provider: AnchorProvider;

    constructor(keyfilePath: string) {
        // Initialize connection to devnet with working RPC endpoint
        this.connection = new Connection("https://devnet.helius-rpc.com/?api-key=1b11f0de-5415-4e65-9ca0-2ff4683dc4e5", "confirmed");
        
        // Load wallet from keyfile
        const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keyfilePath).toString()));
        this.wallet = Keypair.fromSecretKey(secretKey);
        
        // Create wallet adapter
        const walletAdapter: Wallet = {
            publicKey: this.wallet.publicKey,
            signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
                if (tx instanceof Transaction) {
                    tx.partialSign(this.wallet);
                }
                return tx;
            },
            signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
                return txs.map(tx => {
                    if (tx instanceof Transaction) {
                        tx.partialSign(this.wallet);
                    }
                    return tx;
                });
            },
            payer: this.wallet
        };
        
        // Create provider and program
        this.provider = new AnchorProvider(
            this.connection,
            walletAdapter,
            { commitment: 'confirmed' }
        );
        this.program = new Program(IDL, PERPETUALS_PROGRAM_ID, this.provider);
    }

    async openLongPosition(collateralAmount: number, size: number): Promise<string> {
        try {
            console.log("Opening long position with parameters:");
            console.log(`Collateral: ${collateralAmount} SOL`);
            console.log(`Size: ${size} SOL`);

            // Get PDAs
            const [transferAuthorityPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("transfer_authority")],
                PERPETUALS_PROGRAM_ID
            );

            const [perpetualsPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("perpetuals")],
                PERPETUALS_PROGRAM_ID
            );

            const [custodyPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("custody"), POOL_PUBKEY.toBuffer(), SOL_MINT.toBuffer()],
                PERPETUALS_PROGRAM_ID
            );

            const [oraclePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("oracle_account"), POOL_PUBKEY.toBuffer(), SOL_MINT.toBuffer()],
                PERPETUALS_PROGRAM_ID
            );

            // Get current oracle price
            const oracleAccount = await this.program.account.customOracle.fetch(oraclePDA);
            const currentPrice = oracleAccount.price.toNumber();
            console.log(`Current oracle price: ${currentPrice / 1_000_000} SOL/USD`);

            // For long positions, we need to use a price slightly higher than the oracle price
            const entryPrice = Math.ceil(currentPrice * 1.01); // Add 1% to account for slippage
            console.log(`Using entry price: ${entryPrice / 1_000_000} SOL/USD`);

            const [custodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("custody_token_account"), POOL_PUBKEY.toBuffer(), SOL_MINT.toBuffer()],
                PERPETUALS_PROGRAM_ID
            );

            const [positionPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("position"),
                    this.wallet.publicKey.toBuffer(),
                    POOL_PUBKEY.toBuffer(),
                    custodyPDA.toBuffer(),
                    Buffer.from([1]) // 1 for long
                ],
                PERPETUALS_PROGRAM_ID
            );

            // Get user's SOL token account
            const userTokenAccount = await getAssociatedTokenAddress(
                SOL_MINT,
                this.wallet.publicKey
            );

            // Convert amounts to lamports
            const collateralLamports = collateralAmount * LAMPORTS_PER_SOL;
            const sizeLamports = size * LAMPORTS_PER_SOL;
            const feeLamports = Math.ceil(sizeLamports * 0.001); // 0.1% fee
            const totalNeeded = collateralLamports + feeLamports;

            // Create transaction
            const transaction = new Transaction();

            // Create token account if needed
            const accountInfo = await this.connection.getAccountInfo(userTokenAccount);
            if (!accountInfo) {
                transaction.add(
                    createAssociatedTokenAccountInstruction(
                        this.wallet.publicKey,
                        userTokenAccount,
                        this.wallet.publicKey,
                        SOL_MINT
                    )
                );
            }

            // Wrap SOL
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: this.wallet.publicKey,
                    toPubkey: userTokenAccount,
                    lamports: totalNeeded
                }),
                createSyncNativeInstruction(userTokenAccount)
            );

            // Approve spending
            transaction.add(
                createApproveInstruction(
                    userTokenAccount,
                    transferAuthorityPDA,
                    this.wallet.publicKey,
                    totalNeeded
                )
            );

            // Add open position instruction
            const openPositionIx = await this.program.methods.openPosition({
                price: new BN(entryPrice), // Use entry price with slippage
                collateral: new BN(collateralLamports),
                size: new BN(sizeLamports),
                side: { long: {} }
            })
            .accounts({
                owner: this.wallet.publicKey,
                fundingAccount: userTokenAccount,
                transferAuthority: transferAuthorityPDA,
                perpetuals: perpetualsPDA,
                pool: POOL_PUBKEY,
                position: positionPDA,
                custody: custodyPDA,
                custodyOracleAccount: oraclePDA,
                collateralCustody: custodyPDA,
                collateralCustodyOracleAccount: oraclePDA,
                collateralCustodyTokenAccount: custodyTokenAccountPDA,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .instruction();

            transaction.add(openPositionIx);

            // Send transaction
            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.wallet],
                {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                    commitment: 'confirmed'
                }
            );

            console.log("Position opened successfully!");
            console.log("Transaction signature:", signature);
            console.log("Position PDA:", positionPDA.toBase58());

            return signature;

        } catch (error) {
            console.error("Error opening position:", error);
            throw error;
        }
    }

    async closePosition(positionPDA: PublicKey): Promise<string> {
        try {
            console.log("Closing position:", positionPDA.toBase58());

            // Get PDAs
            const [transferAuthorityPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("transfer_authority")],
                PERPETUALS_PROGRAM_ID
            );

            const [perpetualsPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("perpetuals")],
                PERPETUALS_PROGRAM_ID
            );

            // Get position data
            const position = await this.program.account.position.fetch(positionPDA);
            
            // Get user's receiving account
            const userTokenAccount = await getAssociatedTokenAddress(
                SOL_MINT,
                this.wallet.publicKey
            );

            // Get current oracle price
            const [oraclePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("oracle_account"), POOL_PUBKEY.toBuffer(), SOL_MINT.toBuffer()],
                PERPETUALS_PROGRAM_ID
            );
            const oracleAccount = await this.program.account.customOracle.fetch(oraclePDA);
            const currentPrice = oracleAccount.price.toNumber();

            // Create close position instruction
            const closePositionIx = await this.program.methods.closePosition({
                price: new BN(currentPrice)
            })
            .accounts({
                owner: this.wallet.publicKey,
                receivingAccount: userTokenAccount,
                transferAuthority: transferAuthorityPDA,
                perpetuals: perpetualsPDA,
                pool: POOL_PUBKEY,
                position: positionPDA,
                custody: position.custody,
                custodyOracleAccount: oraclePDA,
                collateralCustody: position.collateralCustody,
                collateralCustodyOracleAccount: oraclePDA,
                collateralCustodyTokenAccount: userTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .instruction();

            // Create and send transaction
            const transaction = new Transaction().add(closePositionIx);
            
            const signature = await sendAndConfirmTransaction(
                this.connection,
                transaction,
                [this.wallet],
                {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                    commitment: 'confirmed'
                }
            );

            console.log("Position closed successfully!");
            console.log("Transaction signature:", signature);

            return signature;

        } catch (error) {
            console.error("Error closing position:", error);
            throw error;
        }
    }

    async getPositions(): Promise<PublicKey[]> {
        try {
            const positions = await this.program.account.position.all([
                {
                    memcmp: {
                        offset: 8, // After discriminator
                        bytes: this.wallet.publicKey.toBase58()
                    }
                }
            ]);

            return positions.map((p: any) => p.publicKey);
        } catch (error) {
            console.error("Error fetching positions:", error);
            throw error;
        }
    }
}

// Example usage
async function main() {
    // Create manager instance with your keypair file
    const manager = new PerpsPositionManager("perpetuals/scripts/keypair.json");

    try {
        // Calculate size based on leverage (8x)
        const collateral = 0.01; // 0.01 SOL
        const leverage = 8; // Reduced from 10x to 8x to account for fees
        const fee = 0.00255; // Updated fee from logs
        const effectiveCollateral = collateral - fee; // Subtract fees from collateral
        const size = 0.06; // Reduced to maintain ~8x leverage after fees
        const targetPrice = 38.00; // $38.00

        console.log("Opening a position with the following parameters:");
        console.log(`- Collateral: ${collateral} SOL`);
        console.log(`- Size: ${size} SOL`);
        console.log(`- Leverage: ${leverage}x`);
        console.log(`- Target Price: $${targetPrice.toFixed(2)}`);

        // Open the position
        console.log("\nOpening position...");
        const openTxId = await manager.openLongPosition(collateral, size);
        console.log("Position opened successfully!");
        console.log("Transaction ID:", openTxId);

        // Get all positions
        console.log("\nFetching positions...");
        const positions = await manager.getPositions();
        console.log("Current positions:", positions.map(p => p.toString()));

    } catch (error: any) {
        console.error("Error:", error?.message || error);
        if (error?.logs) {
            console.error("Transaction logs:", error.logs);
        }
    }
}

// Run the example
main(); 