import { PublicKey } from "@solana/web3.js";
import { program } from "./config";

const SOL_CUSTODY_PDA = new PublicKey("FxpbNE2X7viR51kqULM6UfA6NcYv5c9DkLNjmg1FWNL3");

async function main() {
    // Fetch the custody account
    const custody = await program.account.custody.fetch(SOL_CUSTODY_PDA);
    
    console.log("Custody Account Info:");
    console.log("Oracle Account:", custody.oracle.oracleAccount.toString());
    console.log("Oracle Type:", custody.oracle.oracleType);
    console.log("Oracle Authority:", custody.oracle.oracleAuthority.toString());
    console.log("Max Price Error:", custody.oracle.maxPriceError.toString());
    console.log("Max Price Age Sec:", custody.oracle.maxPriceAgeSec.toString());
}

main().catch(console.error); 