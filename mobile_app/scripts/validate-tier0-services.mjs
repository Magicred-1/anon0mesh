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

testSolanaPayUri();
testAddressBookCore();
testRecoveryKeyFormatting();
console.log("Tier 0 service checks passed");
