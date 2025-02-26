# Perpetuals DEX Integration Setup Guide

## Prerequisites
- Node.js >= 16
- npm or yarn
- A Solana wallet (e.g., Phantom)

## Installation

1. Install required dependencies:
```bash
npm install @coral-xyz/anchor@0.28.0 \
  @solana/web3.js@1.87.0 \
  @solana/wallet-adapter-base@0.9.23 \
  @solana/wallet-adapter-react@0.15.35 \
  @solana/wallet-adapter-react-ui@0.9.34 \
  @solana/wallet-adapter-wallets@0.19.22 \
  @solana/spl-token@0.3.8
```

## Project Configuration

1. Create a `next.config.js` file:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  transpilePackages: [
    "@coral-xyz/anchor",
    "@solana/web3.js",
    "@solana/spl-token"
  ],
}

module.exports = nextConfig;
```

## Contract Details

```typescript
// Program IDs and PDAs
const PERPETUALS_PROGRAM_ID = "jqmbaTKnPaBodQVayx7V6qsbFKCtSJRqEk8DjHQhAUm";
const TRANSFER_AUTHORITY = "BFjyDDoXqHvhfC8FHuEbBQyNyCe8Z7Qp3VbPtXkQg3Vz";
const PERPETUALS_ADDRESS = "8FhQS3ps7Y7ziHhgzYgEgqGDSKDZpNiZgvxg8AzXVpqq";
```

## Basic Setup Steps

1. Create a wallet provider setup (`src/providers/WalletProvider.tsx`):
```typescript
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo } from 'react';

require('@solana/wallet-adapter-react-ui/styles.css');

export function WalletProviderComponent({ children }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

2. Create a program initialization helper (`src/utils/program.ts`):
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import perpetualsIdl from '@/target/idl/perpetuals.json';

export async function initializeProgram(
  wallet: WalletContextState,
  connection: Connection
) {
  if (!wallet.publicKey) throw new Error('Wallet not connected');

  const provider = new AnchorProvider(
    connection,
    wallet as any,
    { commitment: 'confirmed' }
  );

  return new Program(
    perpetualsIdl,
    new PublicKey(PERPETUALS_PROGRAM_ID),
    provider
  );
}
```

3. Create a basic trading component (`src/components/TradingView.tsx`):
```typescript
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState } from 'react';
import { initializeProgram } from '@/utils/program';

export function TradingView() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [program, setProgram] = useState(null);

  useEffect(() => {
    if (wallet.publicKey) {
      initializeProgram(wallet, connection)
        .then(setProgram)
        .catch(console.error);
    }
  }, [wallet.publicKey, connection]);

  return (
    <div>
      {!wallet.connected ? (
        <button onClick={wallet.connect}>Connect Wallet</button>
      ) : (
        <div>
          {/* Your trading interface */}
        </div>
      )}
    </div>
  );
}
```

## Usage in Next.js App

1. Update your `_app.tsx`:
```typescript
import { WalletProviderComponent } from '@/providers/WalletProvider';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletProviderComponent>
      <Component {...pageProps} />
    </WalletProviderComponent>
  );
}
```

## Important Notes

1. **Server-Side Rendering (SSR)**
   - All wallet and connection operations must be client-side only
   - Use dynamic imports or client-side components for wallet-related code
   - Add checks for `typeof window !== 'undefined'`

2. **Error Handling**
   - Always handle wallet connection errors
   - Implement proper transaction error handling
   - Add loading states for transactions

3. **Security**
   - Never expose private keys
   - Validate all transactions before signing
   - Implement proper transaction confirmation handling

4. **Network**
   - The contract is deployed on Devnet
   - Use appropriate network endpoints for testing/production

## Common Issues and Solutions

1. **Window is not defined**
   - Wrap components using browser APIs with dynamic imports
   - Use `useEffect` for browser-specific code

2. **Wallet Connection Issues**
   - Ensure wallet adapter is properly configured
   - Check network compatibility
   - Handle wallet connection states

3. **Transaction Errors**
   - Implement proper error boundaries
   - Add retry mechanisms for failed transactions
   - Show user-friendly error messages

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Testing

1. Connect your wallet to Devnet
2. Get some SOL from a Devnet faucet
3. Test basic operations:
   - Wallet connection
   - Reading contract state
   - Making transactions

## Support

For issues and questions:
- Check the [Solana Cookbook](https://solanacookbook.com/)
- Visit the [Anchor Documentation](https://www.anchor-lang.com/)
- Join the [Solana Discord](https://discord.com/invite/solana) 