import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { program, poolName, SOL_MINT, GEMSTEST_MINT, wallet } from "./config";

// Base prices (with 6 decimals)
const BASE_SOL_PRICE = new BN(34_505_125); // $34.50 with 6 decimals (current oracle price)
const BASE_GEMS_PRICE = new BN(10_000_000);  // $10

// Keep track of last prices
let lastSolPrice = BASE_SOL_PRICE;
let lastGemsPrice = BASE_GEMS_PRICE;

async function updateOraclePrices() {
    try {
        const [poolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("pool"), Buffer.from(poolName)],
            program.programId
        );
    
        const [multisigPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("multisig")],
            program.programId
        );

        const [perpetualsPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("perpetuals")],
            program.programId
        );

        // Get SOL custody
        const solCustodyPDA = new PublicKey("FxpbNE2X7viR51kqULM6UfA6NcYv5c9DkLNjmg1FWNL3");
        // Get GEMS custody
        const gemsCustodyPDA = new PublicKey("GQ7DE2pEfoRqvSyuc4MVPAorBvsoco2UkfzqMjdoHoML");

        // Get oracle PDAs
        const [solOraclePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("oracle_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
            program.programId
        );

        const [gemsOraclePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("oracle_account"), poolPDA.toBuffer(), GEMSTEST_MINT.toBuffer()],
            program.programId
        );

        // Use fixed base prices instead of random variations
        const newSolPrice = BASE_SOL_PRICE;
        const newGemsPrice = BASE_GEMS_PRICE;

        // Update SOL price
        await program.methods.setCustomOraclePrice({
            price: newSolPrice,
            expo: -6,
            conf: new BN(10_000), // $0.01 with 6 decimals
            ema: newSolPrice, // Use same as price for simplicity
            publishTime: new BN(Math.floor(Date.now() / 1000))
        })
        .accounts({
            admin: wallet.publicKey,
            multisig: multisigPDA,
            perpetuals: perpetualsPDA,
            pool: poolPDA,
            custody: solCustodyPDA,
            oracleAccount: solOraclePDA,
            systemProgram: SystemProgram.programId
        })
        .rpc();

        // Update GEMS price
        // await program.methods.setCustomOraclePrice({
        //     price: newGemsPrice,
        //     expo: -6,
        //     conf: new BN(10_000), // $0.01 with 6 decimals
        //     ema: newGemsPrice, // Use same as price for simplicity
        //     publishTime: new BN(Math.floor(Date.now() / 1000))
        // })
        // .accounts({
        //     admin: wallet.publicKey,
        //     multisig: multisigPDA,
        //     perpetuals: perpetualsPDA,
        //     pool: poolPDA,
        //     custody: gemsCustodyPDA,
        //     oracleAccount: gemsOraclePDA,
        //     systemProgram: SystemProgram.programId
        // })
        // .rpc();

        // Update last prices
        lastSolPrice = newSolPrice;
        lastGemsPrice = newGemsPrice;

        console.log(`[${new Date().toISOString()}] Updated prices - SOL: $${newSolPrice.toNumber() / 1_000_000}, GEMS: $${newGemsPrice.toNumber() / 1_000_000}`);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error updating prices:`, error);
    }
}

// Run the update every 30 seconds
setInterval(updateOraclePrices, 30000);

// Also run it immediately on startup
updateOraclePrices(); 