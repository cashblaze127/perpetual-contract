import { PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { program, wallet, connection, provider } from "./config";


async function main() {

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

    // Get pool PDAs
    const poolName = "SOLGEMSTEST";
    const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from(poolName)],
        program.programId
    );
    console.log("Pool PDA:", poolPDA.toBase58());

    const [lpTokenMintPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_token_mint"), poolPDA.toBuffer()],
        program.programId
    );

    // Calculate the space needed for the pool account
    const poolSpace = 8 + // discriminator
                     64 + // name (max length)
                     4 + (32 * 10) + // custodies (Vec<Pubkey>) with space for 10 custodies
                     4 + (24 * 10) + // ratios (Vec<TokenRatios>) with space for 10 ratios
                     16 + // aum_usd (u128)
                     1 + // bump
                     1 + // lp_token_bump
                     8; // inception_time (i64)

    // Create the pool account
    const createPoolAccountIx = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: poolPDA,
        space: poolSpace,
        lamports: await connection.getMinimumBalanceForRentExemption(poolSpace),
        programId: program.programId
    });

    // Initialize the pool
    const addPoolIx = await program.methods.addPool({
        name: poolName
    })
    .accounts({
        admin: wallet.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        lpTokenMint: lpTokenMintPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY
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
    const tx = new Transaction().add(addPoolIx);
    const sig = await provider.sendAndConfirm(tx);
    console.log("Pool created with tx:", sig);
    console.log("Pool pubkey:", poolPDA.toBase58());
    console.log("LP Token Mint pubkey:", lpTokenMintPDA.toBase58());
}

main().catch(console.error); 