import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { keypair, program, SOL_MINT } from "./config";

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
    
    const poolName = "SOLGEMSTEST";
    const [poolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), Buffer.from(poolName)],
        program.programId
    );

    // Add SOL custody
    console.log("Adding SOL custody...");
    const [solCustodyPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );

    const [solCustodyTokenAccountPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("custody_token_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
    );
 
    let multisig = await program.account.pool.fetch(
        poolPDA
      );
      console.log(multisig)

    let [oracleAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("oracle_account"), poolPDA.toBuffer(), SOL_MINT.toBuffer()],
        program.programId
      );

    await program.methods.addCustody({
        isStable: false,
        isVirtual: false,
        oracle: {
            oracleAccount: oracleAccount, // new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // Pyth SOL/USD
            oracleType: { custom: {} },
            // maxPriceError: new BN(100),
            maxPriceError: new BN(10000),
            maxPriceAgeSec: 60,
            // maxPriceAgeSec: 31536000, // 1 year
            oracleAuthority: keypair.publicKey,
        },
        pricing: {
            // useEma: true,
            // useUnrealizedPnlInAum: true,
            // tradeSpreadLong: new BN(100),
            // tradeSpreadShort: new BN(100),
            // swapSpread: new BN(300),
            // minInitialLeverage: new BN(10),
            // maxInitialLeverage: new BN(1000000000),
            // maxLeverage: new BN(1000000000),
            // maxPayoffMult: new BN(10000),
            // maxUtilization: new BN(900000),
            // maxPositionLockedUsd: new BN(1000000000),
            // maxTotalLockedUsd: new BN(10000000000)
            useEma: true,
            useUnrealizedPnlInAum: true,
            tradeSpreadLong: new BN(100),
            tradeSpreadShort: new BN(100),
            swapSpread: new BN(200),
            minInitialLeverage: new BN(10000),
            maxInitialLeverage: new BN(1000000),
            maxLeverage: new BN(1000000),
            maxPayoffMult: new BN(10000),
            maxUtilization: new BN(10000),
            maxPositionLockedUsd: new BN(1000000000),
            maxTotalLockedUsd: new BN(1000000000),
        },
        permissions: {
            // allowSwap: true,
            // allowAddLiquidity: true,
            // allowRemoveLiquidity: true,
            // allowOpenPosition: true,
            // allowClosePosition: true,
            // allowPnlWithdrawal: true,
            // allowCollateralWithdrawal: true,
            // allowSizeChange: true
            allowSwap: true,
            allowAddLiquidity: true,
            allowRemoveLiquidity: true,
            allowOpenPosition: true,
            allowClosePosition: true,
            allowPnlWithdrawal: true,
            allowCollateralWithdrawal: true,
            allowSizeChange: true,
        },
        fees: {
            // mode: { linear: {} },
            // ratioMult: new BN(20000),
            // utilizationMult: new BN(20000),
            // swapIn: new BN(100),
            // swapOut: new BN(100),
            // stableSwapIn: new BN(100),
            // stableSwapOut: new BN(100),
            // addLiquidity: new BN(0),
            // removeLiquidity: new BN(0),
            // openPosition: new BN(100),
            // closePosition: new BN(0),
            // liquidation: new BN(50),
            // protocolShare: new BN(25),
            // feeMax: new BN(0),
            // feeOptimal: new BN(0)
            mode: { linear: {} },
            ratioMult: new BN(20000),
            utilizationMult: new BN(20000),
            swapIn: new BN(100),
            swapOut: new BN(100),
            stableSwapIn: new BN(100),
            stableSwapOut: new BN(100),
            addLiquidity: new BN(100),
            removeLiquidity: new BN(100),
            openPosition: new BN(100),
            closePosition: new BN(100),
            liquidation: new BN(100),
            protocolShare: new BN(10),
            feeMax: new BN(250),
            feeOptimal: new BN(10),
        },
        borrowRate: {
            baseRate: new BN(0),
            slope1: new BN(80000),
            slope2: new BN(120000),
            optimalUtilization: new BN(800000000)
        },
        ratios: [
            // {
            //     target: new BN(3333), // ~33.33%
            //     min: new BN(2500),    // 25%
            //     max: new BN(4000)     // 40%
            // },
            // {
            //     target: new BN(3333), // ~33.33%
            //     min: new BN(2500),    // 25%
            //     max: new BN(4000)     // 40%
            // },
            // {
            //     target: new BN(3334), // ~33.33%
            //     min: new BN(2500),    // 25%
            //     max: new BN(4000)     // 40%
            // }
            {
                target: new BN(5000),
                min: new BN(10),
                max: new BN(10000),
              },
              {
                target: new BN(5000),
                min: new BN(10),
                max: new BN(10000),
              },
        ]
    })
    .accounts({
        admin: keypair.publicKey,
        multisig: multisigPDA,
        transferAuthority: transferAuthorityPDA,
        perpetuals: perpetualsPDA,
        pool: poolPDA,
        custody: solCustodyPDA,
        custodyTokenAccount: solCustodyTokenAccountPDA,
        custodyTokenMint: SOL_MINT,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY
    })
    .rpc();

    console.log("SOL custody added successfully!");
    console.log("SOL custody address:", solCustodyPDA.toBase58());
    console.log("SOL custody token account:", solCustodyTokenAccountPDA.toBase58());
}

main().catch(console.error); 