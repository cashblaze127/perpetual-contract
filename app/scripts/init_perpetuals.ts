import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
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

    const [transferAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("transfer_authority")],
        program.programId
    );

    const [perpetualsPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("perpetuals")],
        program.programId
    );

    // Initialize the perpetuals account
    const initIx = await program.methods.init({
        minSignatures: 1,
        allowSwap: true,
        allowAddLiquidity: true,
        allowRemoveLiquidity: true,
        allowOpenPosition: true,
        allowClosePosition: true,
        allowPnlWithdrawal: true,
        allowCollateralWithdrawal: true,
        allowSizeChange: true
    })
    .accounts({
        upgradeAuthority: wallet.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        perpetualsProgramData: new PublicKey("6FghwnrNePAySuuvez6icaroZE1kcRAV1SK5PVXL9jJ3"),
        perpetualsProgram: program.programId,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID
    })
    .remainingAccounts([
        {
            pubkey: wallet.publicKey,
            isWritable: false,
            isSigner: true
        }
    ])
    .instruction();

    // Send transaction
    const tx = new Transaction().add(initIx);
    const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
    console.log("Perpetuals initialized with tx:", sig);
    console.log("Perpetuals pubkey:", perpetualsPDA.toBase58());
    console.log("Multisig pubkey:", multisigPDA.toBase58());
    console.log("Transfer Authority pubkey:", transferAuthorityPDA.toBase58());
}

main().catch(console.error); 