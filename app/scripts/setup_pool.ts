import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import perpetualsIdl from "../target/idl/perpetuals.json";

const PERPETUALS_PROGRAM_ID = new PublicKey("Eq8gsA19Ah1u32p71c7tDz5TstJzKMgp4YMRQxAon4au");
const GEMSTEST_MINT = new PublicKey("46B2XErp9cT63zJnySzUnyqksStoMmQSCjgRUVyUxjMG");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

// Replace this with the oracle pubkey from the create_oracle script output
const GEMSTEST_ORACLE = new PublicKey("ORACLE_PUBKEY_HERE"); 

async function main() {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load your wallet keypair
    const keypairFile = require('fs').readFileSync('/Users/technoking/.config/solana/id.json', 'utf-8');
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairFile)));
    
    const wallet = {
        publicKey: keypair.publicKey,
        signTransaction: async (tx: Transaction) => {
            tx.sign(keypair);
            return tx;
        },
        signAllTransactions: async (txs: Transaction[]) => {
            return txs.map(tx => {
                tx.sign(keypair);
                return tx;
            });
        },
    };

    const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });

    const program = new Program(perpetualsIdl as any, PERPETUALS_PROGRAM_ID, provider);

    // Get PDAs
    const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from("SOLGEMSTEST")],
        program.programId
    );

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

    // Create pool
    console.log("Creating pool...");
    await program.methods.addPool({
        name: "SOLGEMSTEST"
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

    // Add SOL custody
    console.log("Adding SOL custody...");
    const [solCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    const [solCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    await program.methods.addCustody({
        isStable: false,
        isVirtual: false,
        oracle: {
            oracleAccount: new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // Pyth SOL/USD
            oracleType: { pyth: {} },
            maxPriceError: 100,
            maxPriceAgeSec: 60,
        },
        pricing: {
            useEma: true,
            useUnrealizedPnlInAum: true,
            tradeSpreadLong: 100,
            tradeSpreadShort: 100,
            swapSpread: 300,
            minInitialLeverage: 10000,
            maxInitialLeverage: 100000,
            maxLeverage: 100000,
            maxPayoffMult: 10000,
        },
        permissions: {
            allowSwap: true,
            allowAddLiquidity: true,
            allowRemoveLiquidity: true,
            allowOpenPosition: true,
            allowClosePosition: true,
            allowPnlWithdrawal: true,
            allowCollateralWithdrawal: true,
            allowSizeChange: true,
        },
        fees: {
            mode: { linear: {} },
            ratioMult: 20000,
            utilizationMult: 20000,
            swapIn: 100,
            swapOut: 100,
            stableSwapIn: 100,
            stableSwapOut: 100,
            addLiquidity: 0,
            removeLiquidity: 0,
            openPosition: 100,
            closePosition: 0,
            liquidation: 50,
            protocolShare: 25,
        },
        borrowRate: {
            baseRate: 0,
            slope1: 80000,
            slope2: 120000,
            optimalUtilization: 800000000,
        },
        ratios: [
            {
                target: 8000,
                min: 7000,
                max: 9000,
            }
        ],
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        custody: solCustodyPDA,
        custodyTokenAccount: solCustodyTokenAccountPDA,
        custodyTokenMint: SOL_MINT,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

    // Add GEMSTEST custody
    console.log("Adding GEMSTEST custody...");
    const [gemsTestCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody"), poolPDA.toBuffer(), GEMSTEST_MINT.toBuffer()],
        program.programId
    );

    const [gemsTestCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), poolPDA.toBuffer(), GEMSTEST_MINT.toBuffer()],
        program.programId
    );

    await program.methods.addCustody({
        isStable: false,
        isVirtual: false,
        oracle: {
            oracleAccount: GEMSTEST_ORACLE,
            oracleType: { custom: {} },
            maxPriceError: 100,
            maxPriceAgeSec: 60,
        },
        pricing: {
            useEma: true,
            useUnrealizedPnlInAum: true,
            tradeSpreadLong: 100,
            tradeSpreadShort: 100,
            swapSpread: 300,
            minInitialLeverage: 10000,
            maxInitialLeverage: 100000,
            maxLeverage: 100000,
            maxPayoffMult: 10000,
        },
        permissions: {
            allowSwap: true,
            allowAddLiquidity: true,
            allowRemoveLiquidity: true,
            allowOpenPosition: true,
            allowClosePosition: true,
            allowPnlWithdrawal: true,
            allowCollateralWithdrawal: true,
            allowSizeChange: true,
        },
        fees: {
            mode: { linear: {} },
            ratioMult: 20000,
            utilizationMult: 20000,
            swapIn: 100,
            swapOut: 100,
            stableSwapIn: 100,
            stableSwapOut: 100,
            addLiquidity: 0,
            removeLiquidity: 0,
            openPosition: 100,
            closePosition: 0,
            liquidation: 50,
            protocolShare: 25,
        },
        borrowRate: {
            baseRate: 0,
            slope1: 80000,
            slope2: 120000,
            optimalUtilization: 800000000,
        },
        ratios: [
            {
                target: 2000,
                min: 1000,
                max: 3000,
            }
        ],
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        custody: gemsTestCustodyPDA,
        custodyTokenAccount: gemsTestCustodyTokenAccountPDA,
        custodyTokenMint: GEMSTEST_MINT,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

    console.log("Pool setup complete!");
    console.log("Pool address:", poolPDA.toBase58());
    console.log("SOL custody:", solCustodyPDA.toBase58());
    console.log("GEMSTEST custody:", gemsTestCustodyPDA.toBase58());
}

main().catch(console.error); 