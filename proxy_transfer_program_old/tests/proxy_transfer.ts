
import { AnchorProvider, BN, setProvider, web3 } from "@coral-xyz/anchor";
import * as proxyTransferClient from "../app/program_client";
import chai from "chai";
import { assert, expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
chai.use(chaiAsPromised);

const programId = new web3.PublicKey("EPMnEyFDUz6mf8vTMcfq7J9jbhy3wZgRVsuSUZjjC5CZ");

describe("proxy_transfer tests", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const systemWallet = (provider.wallet as NodeWallet).payer;

  it("First test", async () => {
    // Add your test here
  });
});
