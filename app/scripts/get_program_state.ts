import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';

const PERPETUALS_PROGRAM_ID = new PublicKey("J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS");
const POOL_PUBKEY = new PublicKey("4oeCDy1bksQPCaPpUYkhQo9DihqWNAecchcwJLnKo6E7");

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

    // Get PDAs
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

    try {
        // Try to fetch the multisig account
        const multisig = await program.account.multisig.fetch(multisigPDA);
        console.log("Multisig account exists:", multisigPDA.toBase58());
        console.log("Multisig state:", multisig);
    } catch (err) {
        console.log("Multisig account does not exist or is not initialized");
    }

    try {
        // Try to fetch the perpetuals account
        const perpetuals = await program.account.perpetuals.fetch(perpetualsPDA);
        console.log("\nPerpetuals account exists:", perpetualsPDA.toBase58());
        console.log("Perpetuals state:", perpetuals);
    } catch (err) {
        console.log("Perpetuals account does not exist or is not initialized");
    }

    // Check if transfer authority exists
    const transferAuthorityInfo = await connection.getAccountInfo(transferAuthorityPDA);
    console.log("\nTransfer authority account exists:", transferAuthorityPDA.toBase58());
    console.log("Transfer authority account info:", transferAuthorityInfo);

    // Fetch pool data
    try {
        const pool = await program.account.pool.fetch(POOL_PUBKEY);
        console.log("\nPool account exists:", POOL_PUBKEY.toBase58());
        console.log("Pool state:", pool);
        console.log("\nPool ratios:", pool.ratios);
    } catch (err) {
        console.log("Pool account does not exist or is not initialized");
        console.error(err);
    }
}

main().catch(console.error); 