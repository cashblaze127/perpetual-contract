import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';

const PERPETUALS_PROGRAM_ID = new PublicKey("jqmbaTKnPaBodQVayx7V6qsbFKCtSJRqEk8DjHQhAUm");

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
    
    // Create a new keypair for the oracle
    const oracleKeypair = Keypair.generate();
    console.log("Oracle account:", oracleKeypair.publicKey.toBase58());

    // Initialize the oracle account
    const createAccountIx = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: oracleKeypair.publicKey,
        lamports: await connection.getMinimumBalanceForRentExemption(80), // Size of CustomOracle
        space: 80,
        programId: PERPETUALS_PROGRAM_ID
    });

    // Set initial price data (price: $1, confidence: 0.01, expo: -6)
    const price = new BN(1_000_000); // $1 with 6 decimals
    const expo = -6;
    const conf = new BN(10_000); // $0.01 with 6 decimals
    const publishTime = Math.floor(Date.now() / 1000);

    const [multisigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("multisig")],
        program.programId
    );

    const [perpetualsPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        program.programId
    );

    const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from("SOLGEMSTEST")],
        program.programId
    );

    const [custodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody")],
        program.programId
    );

    const setDataIx = await program.methods.setCustomOraclePrice({
        price,
        expo,
        conf,
        ema: price, // EMA same as price initially
        publishTime: new BN(publishTime)
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        custody: custodyPDA,
        oracleAccount: oracleKeypair.publicKey,
        systemProgram: SystemProgram.programId
    })
    .instruction();

    // Send transaction
    const tx = new Transaction().add(createAccountIx, setDataIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair, oracleKeypair]);
    console.log("Oracle initialized with tx:", sig);
    console.log("Oracle pubkey:", oracleKeypair.publicKey.toBase58());
}

main().catch(console.error); 