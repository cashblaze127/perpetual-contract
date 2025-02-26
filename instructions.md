# Transaction Instructions for Opening Position

## Error Details
```
Error Code: ConstraintRaw (2003)
Error Message: A raw constraint was violated.
Error Account: funding_account
Program: J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS
```

## Transaction Structure

### Instruction 1: ComputeBudget
Set compute unit limit for the transaction

### Instruction 2: OpenPosition
Program: `J6k8HWiv8FdHorsPxFGAKfthDEKddYkYhTw6H3Q84SAS`
#### Parameters Being Sent:
1. Pool Name: "SOLGEMSTEST"
2. Token Mint: (coin address from the UI)
3. Collateral Mint: (selected collateral token address)
4. Position Side: ${positionSide} (long/short)
5. Limit Price: 
   - For market orders:
     - Long: Number.MAX_SAFE_INTEGER
     - Short: 1
   - For limit orders: (price * 10^decimals)
6. Collateral Amount: (amount * 10^collateralDecimals)
7. Position Size: (size * 10^decimals)
#### Instruction Data
```typescript
{
  openPosition: {
    price: BN, // For market long: Number.MAX_SAFE_INTEGER, for short: 1
    collateral: BN, // collateralAmount * 10^decimals
    size: BN, // size * 10^decimals
    side: { long: {} } | { short: {} } // Variant enum
  }
}
```

#### Required Accounts (in order)
```typescript
{
  owner: PublicKey,              // Wallet public key (Signer, Mutable)
  fundingAccount: PublicKey,     // Associated Token Account for collateral (Mutable)
  transferAuthority: PublicKey,  // PDA with authority over transfers
  perpetuals: PublicKey,         // Main program state account
  pool: PublicKey,               // Pool PDA ("SOLGEMSTEST")
  position: PublicKey,           // Position PDA [owner, pool, custody, side]
  custody: PublicKey,            // Token custody PDA
  custodyOracleAccount: PublicKey, // Oracle account for price feed
  collateralCustody: PublicKey,  // Collateral custody PDA
  collateralCustodyOracleAccount: PublicKey, // Oracle for collateral
  collateralCustodyTokenAccount: PublicKey, // Token account for custody
  systemProgram: PublicKey,      // System program for account creation
  tokenProgram: PublicKey        // Token program for transfers
}
```

#### PDA Derivation
```typescript
// Pool PDA
[Buffer.from("pool"), poolName]

// Custody PDA
[Buffer.from("custody"), pool.toBuffer(), tokenMint.toBuffer()]

// Position PDA
[
  Buffer.from("position"),
  owner.toBuffer(),
  pool.toBuffer(),
  custody.toBuffer(),
  Buffer.from([side === "long" ? 1 : 0])
]
#### Required Accounts:
1. owner (Signer): User's wallet public key
2. funding_account (Mutable): Account for funding the position
3. pool (Mutable): Pool account address
4. position (Mutable): Position account
5. custody (Mutable): Token custody account
6. collateral_custody (Mutable): Collateral custody account

// Oracle PDA
[Buffer.from("oracle_account"), pool.toBuffer(), tokenMint.toBuffer()]

// Custody Token Account PDA
[Buffer.from("custody_token_account"), pool.toBuffer(), tokenMint.toBuffer()]
```

## Current Implementation
```typescript
// Create transaction
const transaction = await perpsClient.createOpenPositionTransaction(
  "SOLGEMSTEST",
  tokenMint,
  collateralMint,
  positionSide,
  limitPrice,
  collateral,
  size
);

// Add ATA creation if needed
if (createAtaIx) {
  transaction.add(createAtaIx);
}

// Add open position instruction
transaction.add(openPositionIx);
```

## Error Analysis
The error `ConstraintRaw` (2003) on the `funding_account` suggests that:
1. The funding account (ATA) may not exist
2. The funding account may not have enough tokens
3. The funding account owner constraints are not met

The transaction is attempting to use the Associated Token Account (ATA) as the funding account, but the error suggests either:
1. The ATA creation instruction is failing
2. The ATA exists but doesn't meet the program's requirements
3. The wallet doesn't have sufficient token balance in the ATA

To debug:
1. Verify ATA exists: `getAssociatedTokenAddress(collateralMint, wallet.publicKey)`
2. Check ATA balance: `getTokenAccountBalance(fundingAccount)`
3. Verify ATA ownership and authority 