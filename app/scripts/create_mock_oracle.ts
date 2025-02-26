import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';

const PERPETUALS_PROGRAM_ID = new PublicKey("J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS");
const POOL_PUBKEY = new PublicKey("4oeCDy1bksQPCaPpUYkhQo9DihqWNAecchcwJLnKo6E7");
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const GEMS_MINT = new PublicKey("46B2XErp9cT63zJnySzUnyqksStoMmQSCjgRUVyUxjMG");

async function main() {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load admin keypair
    const adminKeypair = Keypair.fromSecretKey(Buffer.from([209,33,195,157,5,67,186,111,38,97,130,49,55,145,174,172,226,165,22,65,56,224,158,253,95,71,41,17,182,173,37,138,33,20,78,102,94,77,38,104,54,77,51,205,185,65,12,233,238,231,247,149,94,37,55,205,177,156,5,118,201,70,136,101]));
    const wallet = new NodeWallet(adminKeypair);

    const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
    });

    const program = new Program(IDL, PERPETUALS_PROGRAM_ID, provider);

    const [multisigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("multisig")],
        program.programId
    );

    const [perpetualsPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        program.programId
    );

    // Get SOL custody
    const solCustodyPDA = new PublicKey("5N52RgrRnsXnfiLX3p7mv1cRSvWJGT4AidGEeg6UcUiQ");

    // Get GEMS custody
    const gemsCustodyPDA = new PublicKey("GQ7DE2pEfoRqvSyuc4MVPAorBvsoco2UkfzqMjdoHoML");

    // Create mock oracle for SOL/USD
    console.log("Setting SOL/USD oracle price...");
    const [solOraclePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_account"), POOL_PUBKEY.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );
    console.log("SOL oracle account:", solOraclePDA.toBase58());
    
    const solPrice = new BN(34_500_000); // $34.50 with 6 decimals
    
    await program.methods.setCustomOraclePrice({
        price: solPrice,
        expo: -6,
        conf: new BN(10_000), // $0.01 with 6 decimals
        ema: solPrice, // Same as price
        publishTime: new BN(Math.floor(Date.now() / 1000))
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        perpetuals: perpetualsPDA,
        pool: POOL_PUBKEY,
        custody: solCustodyPDA,
        oracleAccount: solOraclePDA,
        systemProgram: SystemProgram.programId
    })
    .rpc();

    console.log("SOL/USD oracle price set at:", solOraclePDA.toBase58());

    // Create mock oracle for GEMS/USD
    console.log("Setting GEMS/USD oracle price...");
    const [gemsOraclePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_account"), POOL_PUBKEY.toBuffer(), GEMS_MINT.toBuffer()],
        program.programId
    );
    console.log("GEMS oracle account:", gemsOraclePDA.toBase58());
    
    await program.methods.setCustomOraclePrice({
        price: new BN(10_000_000), // $10 with 6 decimals
        expo: -6,
        conf: new BN(10_000), // $0.01 with 6 decimals
        ema: new BN(10_000_000), // Same as price
        publishTime: new BN(Math.floor(Date.now() / 1000))
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        perpetuals: perpetualsPDA,
        pool: POOL_PUBKEY,
        custody: gemsCustodyPDA,
        oracleAccount: gemsOraclePDA,
        systemProgram: SystemProgram.programId
    })
    .rpc();

    console.log("GEMS/USD oracle price set at:", gemsOraclePDA.toBase58());
}

main().catch(console.error); 