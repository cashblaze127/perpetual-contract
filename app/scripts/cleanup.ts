import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
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

    // Get all program accounts
    const accounts = await connection.getProgramAccounts(PERPETUALS_PROGRAM_ID);
    console.log(`Found ${accounts.length} accounts to close`);

    // Close each account
    for (const account of accounts) {
        try {
            console.log(`\nClosing account ${account.pubkey.toBase58()}`);
            
            // Get the account balance
            const balance = await connection.getBalance(account.pubkey);
            console.log(`Account balance: ${balance / LAMPORTS_PER_SOL} SOL`);

            // Get the account info
            const accountInfo = await connection.getAccountInfo(account.pubkey);
            if (accountInfo) {
                console.log(`Account data size: ${accountInfo.data.length} bytes`);
            }

            // Try to close the account using Anchor
            try {
                await program.methods.closeAccount()
                    .accounts({
                        account: account.pubkey,
                        authority: wallet.publicKey,
                        recipient: wallet.publicKey,
                    })
                    .rpc();
                console.log("Account closed successfully");
            } catch (e) {
                console.log("Failed to close account with Anchor:", e);
            }

        } catch (error) {
            console.error(`Error closing account ${account.pubkey.toBase58()}:`, error);
        }
    }

    // Now try to close the program itself
    try {
        console.log("\nClosing program account...");
        const programBalance = await connection.getBalance(PERPETUALS_PROGRAM_ID);
        console.log(`Program balance: ${programBalance / LAMPORTS_PER_SOL} SOL`);

        // Try to close the program using Anchor
        try {
            await program.methods.closeProgram()
                .accounts({
                    program: PERPETUALS_PROGRAM_ID,
                    authority: wallet.publicKey,
                    recipient: wallet.publicKey,
                })
                .rpc();
            console.log("Program closed successfully");
        } catch (e) {
            console.log("Failed to close program with Anchor:", e);
        }

    } catch (error) {
        console.error("Error closing program account:", error);
    }

    // List any buffer accounts
    console.log("\nListing buffer accounts...");
    const bufferAccounts = await connection.getProgramAccounts(new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"));
    console.log(`Found ${bufferAccounts.length} buffer accounts`);

    for (const account of bufferAccounts) {
        try {
            console.log(`Buffer account ${account.pubkey.toBase58()}`);
            const balance = await connection.getBalance(account.pubkey);
            console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
        } catch (error) {
            console.error(`Error checking buffer account ${account.pubkey.toBase58()}:`, error);
        }
    }
}

main().catch(console.error); 