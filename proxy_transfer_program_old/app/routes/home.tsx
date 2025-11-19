import type { Route } from "./+types/home";
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "~/components/Header";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home | Solana Program" },
    { name: "description", content: "Welcome to Código Generated Program!" },
  ];
}

const Component = () => {
  const { connected } = useWallet();

  return (
    <>
      <Header />

      <section className="body-font">
        <div className="container mx-auto flex px-5 py-24 md:flex-row flex-col items-center">
          <div className="lg:flex-grow md:w-1/2 lg:pr-24 md:pr-16 flex flex-col md:items-start md:text-left mb-16 md:mb-0 items-center text-center">
            <h1 className="title-font sm:text-4xl text-3xl mb-4 font-medium ">
              Congratulations! 👏
            </h1>
            <p className="mb-8 leading-relaxed">
              You have successfully generated the frontend application for your
              Solana program. This application comes pre-integrated with{" "}
              <code>@solana/wallet-adapter-react</code> for wallet connectivity
              and <code>@solana/web3.js</code> for blockchain interactions. It
              is built using Vite and React Router v7 for efficient development
              and routing. Refer to the{" "}
              <Link to={"/docs"} className={"underline text-blue-500"}>
                Client Docs
              </Link>{" "}
              for detailed instructions on how this web application integrates
              with your program and how to customize it.
            </p>
            <div className="flex justify-center">
              {connected ? <WalletDisconnectButton /> : <WalletMultiButton />}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default function Home() {
  return (
    <WalletModalProvider>
      <Component />
    </WalletModalProvider>
  );
}