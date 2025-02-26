import { Keypair, Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createSyncNativeInstruction } from "@solana/spl-token";
import { connection, program, SOL_MINT, wallet } from "./config";

async function main() {
    const poolName = "SOLGEMSTEST";
    const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from(poolName)],
        program.programId
    );

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

    // Get LP token mint
    const [lpTokenMint] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_token_mint"), poolPDA.toBuffer()],
        program.programId
    );

    

    // Get user's LP token account
    const userLpTokenAccount = await getAssociatedTokenAddress(
        lpTokenMint,
        wallet.publicKey
    );

    // Create LP token account if it doesn't exist
    const lpTokenAccountInfo = await connection.getAccountInfo(userLpTokenAccount);
    if (!lpTokenAccountInfo) {
        console.log("Creating LP token account...");
        const createLpTokenAccountIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userLpTokenAccount,
            wallet.publicKey,
            lpTokenMint
        );
        const tx = new Transaction().add(createLpTokenAccountIx);
        await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    }

    // Get custody accounts for remaining accounts
    // const solCustodyPDA = new PublicKey("5N52RgrRnsXnfiLX3p7mv1cRSvWJGT4AidGEeg6UcUiQ");
    // const gemsCustodyPDA = new PublicKey("GQ7DE2pEfoRqvSyuc4MVPAorBvsoco2UkfzqMjdoHoML");

    // Add SOL liquidity
    console.log("Adding SOL liquidity...");

    const [solCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    // Get or create wrapped SOL account
    const userWrappedSolAccount = await getAssociatedTokenAddress(
        SOL_MINT,
        wallet.publicKey
    );

    // Create wrapped SOL account if it doesn't exist
    const wrappedSolAccountInfo = await connection.getAccountInfo(userWrappedSolAccount);
    if (!wrappedSolAccountInfo) {
        console.log("Creating wrapped SOL account...");
        const createWrappedSolAccountIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userWrappedSolAccount,
            wallet.publicKey,
            SOL_MINT
        );
        const tx = new Transaction().add(createWrappedSolAccountIx);
        await sendAndConfirmTransaction(connection, tx, [wallet.payer]);
    }

    // Transfer SOL to wrapped SOL account
    const solAmount = new BN("300000000000"); // 30 SOL
    const transferSolIx = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: userWrappedSolAccount,
        lamports: solAmount.toNumber()
    });
    const syncNativeIx = createSyncNativeInstruction(userWrappedSolAccount);
    const wrapSolTx = new Transaction().add(transferSolIx).add(syncNativeIx);
    await sendAndConfirmTransaction(connection, wrapSolTx, [wallet.payer]);
    
    const [solCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    const [gemsCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    // Get oracle PDAs
    const [solOraclePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );
    
    // Get remaining accounts
    const remainingAccounts = [
        // Add custody accounts
        {
            pubkey: solCustodyPDA,
            isWritable: false,
            isSigner: false
        },
        // {
        //     pubkey: gemsCustodyPDA,
        //     isWritable: false,
        //     isSigner: false
        // },
        // Add custody oracle accounts
        {
            pubkey: solOraclePDA, // new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // SOL oracle
            isWritable: false,
            isSigner: false
        },
        // {
        //     pubkey: new PublicKey("YECpgLD2CSxxksweubX4rvBr1uPFuLPUkY5PnGE4vXB"), // GEMS oracle
        //     isWritable: false,
        //     isSigner: false
        // }
    ];

    await program.methods.addLiquidity({
        amountIn: solAmount,
        minLpAmountOut: new BN(0)
    })
    .accounts({
        owner: wallet.publicKey,
        fundingAccount: userWrappedSolAccount,
        lpTokenAccount: userLpTokenAccount,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        custody: solCustodyPDA,
        custodyOracleAccount: solOraclePDA, //new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // SOL oracle
        custodyTokenAccount: solCustodyTokenAccountPDA,
        lpTokenMint: lpTokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

    // // Add GEMSTEST liquidity
    // console.log("Adding GEMSTEST liquidity...");
    // const [gemsTestCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
    //     [Buffer.from("custody_token_account"), poolPDA.toBuffer(), GEMSTEST_MINT.toBuffer()],
    //     program.programId
    // );

    // const userGemsTestAccount = await getAssociatedTokenAddress(
    //     GEMSTEST_MINT,
    //     wallet.publicKey
    // );

    // await program.methods.addLiquidity({
    //     amountIn: new BN("10000000000000"), // 10,000 GEMSTEST with 9 decimals
    //     minLpAmountOut: new BN(0)
    // })
    // .accounts({
    //     owner: wallet.publicKey,
    //     fundingAccount: userGemsTestAccount,
    //     lpTokenAccount: userLpTokenAccount,
    //     transferAuthority: transferAuthorityPDA,
    //     perpetuals: perpetualsPDA,
    //     pool: poolPDA,
    //     custody: gemsCustodyPDA,
    //     custodyOracleAccount: GEMSTEST_ORACLE,
    //     custodyTokenAccount: gemsTestCustodyTokenAccountPDA,
    //     lpTokenMint: lpTokenMint,
    //     tokenProgram: TOKEN_PROGRAM_ID,
    // })
    // .remainingAccounts(remainingAccounts)
    // .rpc();

    // console.log("Liquidity added successfully!");
}

main().catch(console.error); 