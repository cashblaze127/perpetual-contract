import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as fs from 'fs';
import { IDL } from "../../target/types/perpetuals";

export const PERPETUALS_PROGRAM_ID = new PublicKey("8Qx5W5JZB6EwPNdKHXKKqkKVwj42Bg5Fy6gARYsyy7St");
export const RPC_URL = "https://devnet.helius-rpc.com/?api-key=05bd1008-0a10-4923-87d9-c61ac8967ced";

const keypairFile = fs.readFileSync('/who/main.json');
export const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(keypairFile.toString())));

export const connection = new Connection(RPC_URL, "confirmed");

export const wallet = new NodeWallet(keypair);

export const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
});

export const program = new Program(IDL, PERPETUALS_PROGRAM_ID, provider);

export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const GEMSTEST_MINT = new PublicKey("3zcQvL5hdzzW9VhMKoDmcMK6NY6njXdp5YpFg8Zer41U");

// Replace this with the oracle pubkey from the create_oracle script output
export const GEMSTEST_ORACLE = new PublicKey("GQ7DE2pEfoRqvSyuc4MVPAorBvsoco2UkfzqMjdoHoML");


export const poolName = "SOLGEMSTEST";