import { Keypair, Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
// import { IDL } from "../target/types/perpetuals";
import * as fs from 'fs';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createSyncNativeInstruction, createCloseAccountInstruction, createApproveInstruction } from "@solana/spl-token";
import { Transaction } from "@solana/web3.js";
import { program, SOL_MINT } from "./config";
import { wallet } from "./config";
import { connection } from "./config";

async function main() {
    // Check devnet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Devnet wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < LAMPORTS_PER_SOL) {
        console.log("Requesting devnet SOL...");
        const airdropSignature = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSignature);
    }

    const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from("SOLGEMSTEST")],
        program.programId
    );


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

    // Open a long position in SOL
    console.log("Opening SOL long position...");
    
    const [solCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    const [solCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    // Get the user's SOL token account
    const userSolTokenAccount = await getAssociatedTokenAddress(
        SOL_MINT,
        wallet.publicKey
    );

    const collateralAmount = new BN(100_000_000); // 0.1 SOL
    const positionSize = new BN(100_000_000); // 0.1 SOL (exactly equal to collateral for 1x leverage)
    const feeAmount = new BN(3_000_000); // 0.003 SOL
    const totalNeeded = new BN(500_000_000); // 0.5 SOL total including buffer

    // First transaction: Close existing token account and create a new one
    const setupInstructions = [];

    try {
        // Check if the token account exists
        await connection.getTokenAccountBalance(userSolTokenAccount);
        console.log("SOL token account exists, closing it...");
        
        // Close the existing token account to unwrap any SOL
        setupInstructions.push(
            createCloseAccountInstruction(
                userSolTokenAccount,
                wallet.publicKey,
                wallet.publicKey
            )
        );
    } catch {
        console.log("Creating SOL token account...");
    }

    // Create new token account
    setupInstructions.push(
        createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userSolTokenAccount,
            wallet.publicKey,
            SOL_MINT
        )
    );

    // Send the setup transaction
    const setupTx = new Transaction().add(...setupInstructions);
    await connection.sendTransaction(setupTx, [wallet.payer]);

    // Wait for token account to be properly initialized
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Waiting for token account initialization...");

    // Second transaction: Wrap SOL
    console.log(`Wrapping ${totalNeeded.toNumber() / LAMPORTS_PER_SOL} SOL...`);

    const wrapInstructions = [
        SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: userSolTokenAccount,
            lamports: totalNeeded.toNumber()
        }),
        createSyncNativeInstruction(userSolTokenAccount)
    ];

    const wrapTx = new Transaction().add(...wrapInstructions);
    await connection.sendTransaction(wrapTx, [wallet.payer]);

    // Wait for balance to be updated
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Waiting for balance update...");

    try {
        const tokenBalance = await connection.getTokenAccountBalance(userSolTokenAccount);
        console.log(`Final wrapped SOL balance: ${tokenBalance.value.uiAmount} SOL`);
    } catch (err) {
        console.error("Error checking final wrapped SOL balance:", err);
    }

    // Third transaction: Approve token account for spending
    console.log("Approving token account for spending...");
    const approveTx = new Transaction().add(
        createApproveInstruction(
            userSolTokenAccount,
            transferAuthorityPDA,
            wallet.publicKey,
            totalNeeded.toNumber()
        )
    );
    await connection.sendTransaction(approveTx, [wallet.payer]);

    // Wait for approval to be confirmed
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("Waiting for approval confirmation...");

    const [positionPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("position"),
            wallet.publicKey.toBuffer(),
            poolPDA.toBuffer(), 
            solCustodyPDA.toBuffer(),
            Buffer.from([1]) // 1 for long
        ],
        program.programId
    );

    // Get custom oracle PDA
    const [solOraclePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    // Fourth transaction: Open position
    console.log("Opening position with parameters:");
    console.log(`- Collateral: ${collateralAmount.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`- Position Size: ${positionSize.toNumber() / LAMPORTS_PER_SOL} SOL`);
    console.log(`- Fee: ${feeAmount.toNumber() / LAMPORTS_PER_SOL} SOL`);

    await program.methods.openPosition({
        price: new BN(34_850_177), // $34.850177 with 6 decimals (matching entry price)
        collateral: collateralAmount,
        size: positionSize,
        side: { long: {} }
    })
    .accounts({
        owner: wallet.publicKey,
        fundingAccount: userSolTokenAccount,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        position: positionPDA,
        custody: solCustodyPDA,
        custodyOracleAccount: solOraclePDA,
        collateralCustody: solCustodyPDA,
        collateralCustodyOracleAccount: solOraclePDA,
        collateralCustodyTokenAccount: solCustodyTokenAccountPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID
    })
    .rpc();

    console.log("Position opened successfully!");
    console.log("Position PDA:", positionPDA.toBase58());
}

main().catch(console.error); 