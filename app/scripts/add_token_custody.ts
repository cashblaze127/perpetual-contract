import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const PERPETUALS_PROGRAM_ID = new PublicKey("J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS");
const POOL_PUBKEY = new PublicKey("4oeCDy1bksQPCaPpUYkhQo9DihqWNAecchcwJLnKo6E7");

// Replace with your Gems token mint address
const YOUR_TOKEN_MINT = new PublicKey("46B2XErp9cT63zJnySzUnyqksStoMmQSCjgRUVyUxjMG");

async function main() {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load your wallet keypair
    const keypairFile = fs.readFileSync('/Users/technoking/.config/solana/id.json', 'utf-8');
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairFile)));
    
    // Create wallet adapter
    const wallet = new NodeWallet(keypair);

    const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });

    const program = new Program(IDL, PERPETUALS_PROGRAM_ID, provider);

    const [multisigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("multisig")],
        program.programId
    );

    const [transferAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("transfer_authority")],
        program.programId
    );

    const [perpetualsPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        program.programId
    );

    const [tokenCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody"), POOL_PUBKEY.toBuffer(), YOUR_TOKEN_MINT.toBuffer()],
        program.programId
    );

    const [tokenCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), POOL_PUBKEY.toBuffer(), YOUR_TOKEN_MINT.toBuffer()],
        program.programId
    );

    // Create a custom oracle for your token
    const [oraclePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_account"), POOL_PUBKEY.toBuffer(), YOUR_TOKEN_MINT.toBuffer()],
        program.programId
    );
    console.log("Oracle PDA:", oraclePDA.toBase58());

    // Add token custody
    const addCustodyIx = await program.methods.addCustody({
        isStable: false,
        isVirtual: false,
        oracle: {
            oracleAccount: oraclePDA,
            oracleType: { custom: {} },
            maxPriceError: new BN(1000),  // 10% max price error
            maxPriceAgeSec: 60,
            oracleAuthority: wallet.publicKey,
        },
        pricing: {
            useEma: false,  // Changed to false for new token
            useUnrealizedPnlInAum: false,  // Changed to false for new token
            tradeSpreadLong: new BN(200),  // 2% spread
            tradeSpreadShort: new BN(200), // 2% spread
            swapSpread: new BN(100),       // 1% spread
            minInitialLeverage: new BN(10000), // 1x min leverage (minimum required)
            maxInitialLeverage: new BN(20000), // 2x max initial leverage
            maxLeverage: new BN(30000),     // 3x absolute max
            maxPayoffMult: new BN(10000),    // 1x max payoff
            maxUtilization: new BN(9000),    // 90% max utilization
            maxPositionLockedUsd: new BN(1000000), // $1M max position
            maxTotalLockedUsd: new BN(10000000)    // $10M max total
        },
        permissions: {
            allowSwap: true,
            allowAddLiquidity: true,
            allowRemoveLiquidity: true,
            allowOpenPosition: true,
            allowClosePosition: true,
            allowPnlWithdrawal: true,
            allowCollateralWithdrawal: true,
            allowSizeChange: true
        },
        fees: {
            mode: { linear: {} },
            ratioMult: new BN(10000),      // 1x ratio multiplier
            utilizationMult: new BN(10000), // 1x utilization multiplier
            swapIn: new BN(30),            // 0.3% fee
            swapOut: new BN(30),           // 0.3% fee
            stableSwapIn: new BN(10),      // 0.1% fee
            stableSwapOut: new BN(10),     // 0.1% fee
            addLiquidity: new BN(0),       // No fee
            removeLiquidity: new BN(0),    // No fee
            openPosition: new BN(10),      // 0.1% fee
            closePosition: new BN(10),     // 0.1% fee
            liquidation: new BN(50),       // 0.5% fee
            protocolShare: new BN(20),     // 20% protocol share
            feeMax: new BN(10000),         // Max fee 100%
            feeOptimal: new BN(7000)       // Optimal fee at 70% utilization
        },
        borrowRate: {
            baseRate: new BN(100),         // 1% base rate
            slope1: new BN(5000),          // 50% slope below optimal
            slope2: new BN(100000),        // 1000% slope above optimal
            optimalUtilization: new BN(8000000) // 80% optimal utilization
        },
        ratios: [
            {
                target: new BN(5000),     // 50% target ratio for SOL
                min: new BN(4000),        // 40% min ratio
                max: new BN(6000)         // 60% max ratio
            },
            {
                target: new BN(5000),     // 50% target ratio for Gems
                min: new BN(4000),        // 40% min ratio
                max: new BN(6000)         // 60% max ratio
            }
        ]
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: POOL_PUBKEY,
        custody: tokenCustodyPDA,
        custodyTokenAccount: tokenCustodyTokenAccountPDA,
        custodyTokenMint: YOUR_TOKEN_MINT,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY
    })
    .instruction();

    // Set initial price data (price: $1, confidence: 0.01, expo: -6)
    const setOraclePriceIx = await program.methods.setCustomOraclePrice({
        price: new BN(1_000_000),
        expo: -6,
        conf: new BN(10_000),
        ema: new BN(1_000_000),
        publishTime: new BN(Math.floor(Date.now() / 1000))
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        perpetuals: perpetualsPDA,
        pool: POOL_PUBKEY,
        custody: tokenCustodyPDA,
        oracleAccount: oraclePDA,
        systemProgram: SystemProgram.programId
    })
    .instruction();

    // Send transaction
    const tx = new Transaction()
        .add(addCustodyIx)
        .add(setOraclePriceIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    console.log("Token custody added with tx:", sig);
    console.log("Token custody pubkey:", tokenCustodyPDA.toBase58());
    console.log("Token custody token account:", tokenCustodyTokenAccountPDA.toBase58());
    console.log("Oracle account:", oraclePDA.toBase58());
}

main().catch(console.error); 