import type { Route } from "./+types/home";
import { Header } from "~/components/Header";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Docs | Solana Program" },
    { name: "description", content: "Welcome to Código Generated Program!" },
  ];
}

export default function Docs() {
  return (
      <>
        <Header />

        <div className="container mx-auto px-6 py-16 max-w-4xl">
          {/* Title */}
          <h1 className="text-3xl font-bold mb-4">
            🧩 React + Solana Program Frontend Template
          </h1>
          <p className="text-lg  mb-8 leading-relaxed">
            A modern, configurable React web application template integrated with
            a Solana program. It includes wallet adapter support, cluster
            switching, and an extensible route system, built using the latest
            React Router architecture.
          </p>

          {/* Section */}
          <h2 className="text-2xl font-semibold mt-10 mb-4">🚀 Features</h2>
          <ul className="list-disc list-inside space-y-2 ">
            <li>🛠 Configurable via environment variables</li>
            <li>
              🔐 Solana Wallet Adapter integration with multiple wallet options
            </li>
            <li>
              🌐 Supports all major Solana clusters (mainnet-beta, testnet,
              devnet, localnet)
            </li>
            <li>⚛️ Powered by React 19 and React Router v7</li>
            <li>📦 Typed with TypeScript and styled with Tailwind CSS</li>
            <li>🧩 SolanaProvider for global connection & wallet access</li>
            <li>📄 Built-in routes for home and docs</li>
          </ul>

          {/* Code Example */}
          <h2 className="text-2xl font-semibold mt-10 mb-4">
            🧪 Project Structure
          </h2>
          <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-sm overflow-x-auto">
          <code>
            {`├── routes/
│   ├── home.tsx
│   └── docs.tsx
├── solana/
│   └── SolanaProvider.tsx
├── App.tsx
├── main.tsx
└── vite.config.ts
`}
          </code>
        </pre>

          {/* Environment Variables */}
          <h2 className="text-2xl font-semibold mt-10 mb-4">
            ⚙️ Environment Variables
          </h2>
          <p className=" mb-4">
            Customize your deployment or development settings through the
            following <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">.env</code>{" "}
            variables:
          </p>
          <pre className="bg-gray-900 text-green-300 rounded-lg p-4 text-sm overflow-x-auto">
          <code>
            {`# Solana Program ID (required)VITE_SOLANA_PROGRAM_ID = YOUR-PROGRAM-ID

# Solana cluster network (optional)
# Options: mainnet-beta | testnet | devnet | localnet
VITE_SOLANA_NETWORK = localnet

# Solana RPC endpoint (optional, overrides network setting)
# VITE_SOLANA_RPC_URL = https: //your-custom-endpoint

# Comma-separated list of wallet adapters (optional)
# Defaults: PhantomWalletAdapter, SolflareWalletAdapter, LedgerWalletAdapter, UnsafeBurnerWalletAdapter
VITE_SOLANA_WALLETS = PhantomWalletAdapter, UnsafeBurnerWalletAdapter`}
          </code>
        </pre>
          <p className="text-sm text-yellow-500 mt-2">
            ⚠️ Invalid or missing values will fallback to sensible defaults and
            show warnings in the console.
          </p>

          {/* Table Example */}
          <h2 className="text-2xl font-semibold mt-10 mb-4">📦 Scripts</h2>
          <table className="table-auto border-collapse w-full text-sm ">
            <thead>
            <tr className="border-b">
              <th className="py-2 px-4 text-left font-medium">Command</th>
              <th className="py-2 px-4 text-left font-medium">Description</th>
            </tr>
            </thead>
            <tbody>
            {[
              ["npm run dev", "Start the dev server"],
              ["npm run build", "Build for production"],
              [
                "npm start",
                <>
                  Serve the built app via{" "}
                  <code className="px-1 py-0.5 rounded text-xs">
                    react-router-serve
                  </code>
                </>
              ],
              ["npm run typecheck", <>Run <code>tsc</code> + route typing</>],
              ["npm run format", "Format all files with Prettier"],
              ["npm run format:check", "Check for Prettier formatting issues"]
            ].map(([cmd, desc], i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-4 font-mono text-blue-600">{cmd}</td>
                  <td className="py-2 px-4">{desc}</td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      </>
  );
}