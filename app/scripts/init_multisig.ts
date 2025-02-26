import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

const PERPETUALS_PROGRAM_ID = new PublicKey("J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS");

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

    const [perpetualsPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        program.programId
    );

    // Initialize multisig
    const setAdminSignersIx = await program.methods.setAdminSigners({
        minSignatures: 1,
        signers: [wallet.publicKey],
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        perpetuals: perpetualsPDA,
        systemProgram: SystemProgram.programId,
    })
    .instruction();

    // Send transaction
    const tx = new Transaction().add(setAdminSignersIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    console.log("Multisig initialized with tx:", sig);
    console.log("Multisig pubkey:", multisigPDA.toBase58());
}

main().catch(console.error); 