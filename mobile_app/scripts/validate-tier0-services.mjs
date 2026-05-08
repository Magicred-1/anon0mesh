import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";

const { buildSolanaPayUri } = await import("../src/services/solanaPayUri.ts");
const {
  MAX_ADDRESS_BOOK_RECIPIENTS,
  normalizeAddressBookEntries,
  normalizeAddressBookPubkey,
  removeAddressBookEntry,
  updateAddressBookEntryLabel,
  upsertAddressBookEntry,
} = await import("../src/services/addressBookCore.ts");
const { formatRecoveryKey } = await import("../src/utils/recoveryKey.ts");
const { parseBaseUnits } = await import("../src/utils/amount.ts");
const { summarizeError } = await import("../src/utils/errors.ts");
const { buildDevnetExplorerTxUrl } = await import("../src/services/explorer.ts");
const { isWalletDenial } = await import("../src/utils/walletDenial.ts");
const { assertSendableSplProgram, UnsupportedTokenProgramError } = await import("../src/services/walletData.ts");

function key(index) {
  const seed = new Uint8Array(32);
  seed.fill(index);
  return Keypair.fromSeed(seed).publicKey.toBase58();
}

function testSolanaPayUri() {
  assert.equal(
    buildSolanaPayUri({
      recipient: " 11111111111111111111111111111111 ",
      amount: "001.230000001",
      label: "Anon Mesh",
      message: "scan me",
      memo: "receive memo",
    }),
    "solana:11111111111111111111111111111111?amount=1.230000001&label=Anon+Mesh&message=scan+me&memo=receive+memo",
  );

  assert.equal(
    buildSolanaPayUri({
      recipient: "11111111111111111111111111111111",
      amount: "0",
      label: "",
      message: "",
    }),
    "solana:11111111111111111111111111111111",
  );

  assert.throws(() => buildSolanaPayUri({ recipient: "  " }), /Recipient is required/);

  const tooManyDecimals = buildSolanaPayUri({
    recipient: "11111111111111111111111111111111",
    amount: "1.0000000001",
  });
  assert.ok(!tooManyDecimals.includes("amount="), "10-decimal SOL amount should be dropped, not encoded");

  const negativeAmount = buildSolanaPayUri({
    recipient: "11111111111111111111111111111111",
    amount: "-1",
  });
  assert.ok(!negativeAmount.includes("amount="), "negative amount should be dropped");

  const nanAmount = buildSolanaPayUri({
    recipient: "11111111111111111111111111111111",
    amount: "abc",
  });
  assert.ok(!nanAmount.includes("amount="), "non-numeric amount should be dropped");

  // Locale-comma decimal handling. Spec mandates "." but locales that
  // render decimal-pad with comma (de-DE, fr-FR, …) deliver "0,5".
  assert.equal(
    buildSolanaPayUri({
      recipient: "11111111111111111111111111111111",
      amount: "0,5",
    }),
    "solana:11111111111111111111111111111111?amount=0.5&label=AnonMesh&message=AnonMesh+receive",
    "comma decimal in amount must normalize to dot",
  );
  assert.equal(
    buildSolanaPayUri({
      recipient: "11111111111111111111111111111111",
      amount: "1,234500",
    }),
    "solana:11111111111111111111111111111111?amount=1.234500&label=AnonMesh&message=AnonMesh+receive",
    "comma decimal with trailing zeros preserved in URI",
  );
  // Whitespace plus comma is the case that locales actually emit.
  assert.equal(
    buildSolanaPayUri({
      recipient: "11111111111111111111111111111111",
      amount: " 0,001 ",
    }),
    "solana:11111111111111111111111111111111?amount=0.001&label=AnonMesh&message=AnonMesh+receive",
    "padded comma decimal must trim and normalize",
  );
  // Receive screen feeds a plain decimal string, not a locale-grouped number
  // (e.g. de-DE "1.234,56"). Normalizer rewrites only the first comma; any
  // surviving separator fails AMOUNT_RE, so the URI must omit amount= rather
  // than encode garbage.
  const multiComma = buildSolanaPayUri({
    recipient: "11111111111111111111111111111111",
    amount: "1,2,3",
  });
  assert.ok(!multiComma.includes("amount="), "multi-comma input must be rejected, not normalized");

  // amount is optional in SolanaPayUriParams. Optional chaining short-circuits
  // the entire trim().replace() chain, so the URI must build cleanly with no
  // amount= rather than crashing on undefined.
  assert.equal(
    buildSolanaPayUri({ recipient: "11111111111111111111111111111111" }),
    "solana:11111111111111111111111111111111?label=AnonMesh&message=AnonMesh+receive",
    "missing amount must produce a recipient-only URI",
  );
}

function testAddressBookCore() {
  const first = key(1);
  const second = key(2);
  assert.equal(normalizeAddressBookPubkey("not a pubkey"), null);
  assert.equal(normalizeAddressBookPubkey(` ${first} `), first);

  let entries = upsertAddressBookEntry([], first, "Alice", 1000);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].label, "Alice");
  assert.equal(entries[0].count, 1);

  entries = upsertAddressBookEntry(entries, first, undefined, 2000);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].label, "Alice");
  assert.equal(entries[0].count, 2);
  assert.equal(entries[0].lastUsed, 2000);

  entries = upsertAddressBookEntry(entries, second, "Bob", 1500);
  assert.equal(entries.map((entry) => entry.pubkey).join(","), `${first},${second}`);

  entries = updateAddressBookEntryLabel(entries, first, "");
  assert.match(entries[0].label, /^.{4}\.\.\..{4}$/);

  entries = removeAddressBookEntry(entries, first);
  assert.deepEqual(entries.map((entry) => entry.pubkey), [second]);

  const noisy = normalizeAddressBookEntries([
    { pubkey: "bad", label: "bad", lastUsed: 999, count: 10 },
    { pubkey: second, label: "old", lastUsed: 1, count: 1 },
    { pubkey: second, label: "new", lastUsed: 2, count: 3 },
  ]);
  assert.equal(noisy.length, 1);
  assert.equal(noisy[0].label, "new");

  let capped = [];
  for (let i = 1; i <= MAX_ADDRESS_BOOK_RECIPIENTS + 5; i += 1) {
    capped = upsertAddressBookEntry(capped, key(i), `entry ${i}`, i);
  }
  assert.equal(capped.length, MAX_ADDRESS_BOOK_RECIPIENTS);
  assert.equal(capped[0].label, `entry ${MAX_ADDRESS_BOOK_RECIPIENTS + 5}`);
}

function testRecoveryKeyFormatting() {
  assert.equal(formatRecoveryKey(""), "");
  assert.equal(formatRecoveryKey("1234567890", 4), "1234\n5678\n90");
  assert.equal(
    formatRecoveryKey("111111111111111111111122222222222222222222223333", 22),
    "1111111111111111111111\n2222222222222222222222\n3333",
  );
  assert.equal(formatRecoveryKey("abc", 0), "a\nb\nc");
}

function testBaseUnitParsing() {
  assert.equal(parseBaseUnits("1", 9), 1_000_000_000n);
  assert.equal(parseBaseUnits("0.000000001", 9), 1n);
  assert.equal(parseBaseUnits("001.2300", 6), 1_230_000n);
  assert.equal(parseBaseUnits(" 1.5 ", 9), 1_500_000_000n);
  assert.equal(parseBaseUnits("1000000", 6), 1_000_000_000_000n);
  assert.throws(() => parseBaseUnits("1abc", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits("1.0000000001", 9), /Too many decimal places/);
  assert.throws(() => parseBaseUnits("0", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits("0.0", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits("-1", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits("", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits(".", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits("1e3", 9), /Invalid amount/);
  assert.throws(() => parseBaseUnits("1,5", 9), /Invalid amount/);
}

function testExplorerUrls() {
  assert.equal(
    buildDevnetExplorerTxUrl("abc+/="),
    "https://explorer.solana.com/tx/abc%2B%2F%3D?cluster=devnet",
  );
  const realLookingSig = "5".repeat(88);
  assert.equal(
    buildDevnetExplorerTxUrl(realLookingSig),
    `https://explorer.solana.com/tx/${realLookingSig}?cluster=devnet`,
  );
}

function testErrorSummaries() {
  assert.equal(
    summarizeError("", "fallback message").message,
    "fallback message",
  );
  assert.equal(
    summarizeError({}, "fallback message").message,
    "fallback message",
  );
  assert.equal(
    summarizeError({ code: -32002, error: "WalletBusy" }, "fallback message").message,
    "WalletBusy -32002",
  );
  assert.equal(
    summarizeError(new Error("boom"), "fallback message").message,
    "boom",
  );
  assert.equal(
    summarizeError(new Error(""), "fallback message").message,
    "fallback message",
  );
  const wrapped = new Error("outer");
  wrapped.cause = new Error("inner");
  assert.match(
    summarizeError(wrapped, "fallback").cause ?? "",
    /inner/,
  );
  assert.equal(
    summarizeError(null, "fallback").message,
    "fallback",
  );
  assert.equal(
    summarizeError(undefined, "fallback").message,
    "fallback",
  );
  assert.equal(
    summarizeError({ message: "primary", error: "secondary", code: 42 }, "fallback").message,
    "primary",
  );
  assert.equal(
    summarizeError({ name: "Boom", error: "Bang" }, "fallback").message,
    "Boom",
  );
}

function testWalletDenialPatterns() {
  // Each fragment from DENIAL_FRAGMENTS — case insensitive, embedded in
  // error message, error name, error code, or raw object — must classify
  // as a user-cancellation so the UI shows "you cancelled" instead of
  // "wallet signing failed".
  const positives = [
    new Error("Authentication cancelled"),
    new Error("Authorization request failed"),
    new Error("AUTH REQUEST FAILED on Seed Vault"),
    new Error("user cancelled the authorization"),
    new Error("transaction was canceled by user"),
    new Error("User declined"),
    new Error("Permission denied"),
    new Error("Operation rejected"),
    new Error("user refused to sign"),
    { error: "Cancelled", code: -32000 },
    { name: "AuthCancelled", message: "" },
    { code: "USER_REJECTED" },
  ];
  for (const err of positives) {
    assert.equal(
      isWalletDenial(err),
      true,
      `expected denial: ${typeof err === "object" ? JSON.stringify(err) : String(err)}`,
    );
  }

  const negatives = [
    new Error("Network request timed out"),
    new Error("Insufficient funds for fee"),
    new Error("Blockhash not found"),
    { code: -32602, message: "Invalid params" },
    null,
    undefined,
    "",
    {},
  ];
  for (const err of negatives) {
    assert.equal(
      isWalletDenial(err),
      false,
      `expected non-denial: ${typeof err === "object" ? JSON.stringify(err) : String(err)}`,
    );
  }
}

function testSplProgramGuard() {
  // The bottom-line guard against Token-2022 sends. Picker hides T22
  // upstream; this is the last line of defense before signing keys see
  // the transaction. Test all known shapes of programId input.
  assertSendableSplProgram("spl-token");

  assert.throws(
    () => assertSendableSplProgram("spl-token-2022"),
    (err) => err instanceof UnsupportedTokenProgramError && /Token-2022/.test(err.message),
    "spl-token-2022 must throw UnsupportedTokenProgramError",
  );
  assert.throws(
    () => assertSendableSplProgram(undefined),
    (err) => err instanceof UnsupportedTokenProgramError,
    "missing programId must throw (defense-in-depth against tampered router params)",
  );
  assert.throws(
    () => assertSendableSplProgram(""),
    (err) => err instanceof UnsupportedTokenProgramError,
    "empty programId must throw",
  );
  assert.throws(
    () => assertSendableSplProgram("spl-token-3000"),
    (err) => err instanceof UnsupportedTokenProgramError,
    "unknown programId must throw",
  );
}

testSolanaPayUri();
testAddressBookCore();
testRecoveryKeyFormatting();
testBaseUnitParsing();
testExplorerUrls();
testErrorSummaries();
testWalletDenialPatterns();
testSplProgramGuard();
console.log("Tier 0 service checks passed");
