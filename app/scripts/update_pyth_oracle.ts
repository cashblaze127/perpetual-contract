import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { PriceStatus, parsePriceData } from "@pythnetwork/client";
import * as fs from 'fs';

const SOL_USD_PRICE_FEED = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

async function main() {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load your wallet keypair
    const keypairFile = fs.readFileSync('/Users/technoking/.config/solana/id.json');
    const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(keypairFile.toString())));

    // Get the Pyth price account data
    const accountInfo = await connection.getAccountInfo(SOL_USD_PRICE_FEED);
    if (!accountInfo) {
        throw new Error("Could not find Pyth price account");
    }

    // Parse the price data
    const priceData = parsePriceData(accountInfo.data);
    console.log("Current SOL/USD price from Pyth oracle:");
    console.log("Price:", priceData.price);
    console.log("Status:", PriceStatus[priceData.status]);
    console.log("Confidence:", priceData.confidence);
    console.log("Last updated:", new Date(Number(priceData.timestamp) * 1000).toLocaleString());

    // Since we're on devnet, we can't update the price directly
    // The stale price is expected on devnet and won't affect our testing
    console.log("\nNote: On devnet, price staleness is expected and won't affect testing");
}

main().catch(console.error); 