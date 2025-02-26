import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { program, wallet, provider } from "./config";

async function main() {

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

    let programData = PublicKey.findProgramAddressSync(
        [program.programId.toBuffer()],
        new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
    )[0];

    // Initialize program
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
        perpetualsProgramData: programData,
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
    const sig = await provider.sendAndConfirm(tx);
    console.log("Program initialized with tx:", sig);
    console.log("Multisig pubkey:", multisigPDA.toBase58());
    console.log("Transfer Authority pubkey:", transferAuthorityPDA.toBase58());
    console.log("Perpetuals pubkey:", perpetualsPDA.toBase58());
}

main().catch(console.error); 