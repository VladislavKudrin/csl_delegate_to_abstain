import {
  LinearFee,
  BigNum,
  TransactionBuilderConfigBuilder,
  TransactionBuilder,
  Bip32PrivateKey,
  BaseAddress,
  NetworkInfo,
  Credential,
  DRep,
  VoteDelegation,
  Certificates,
  Certificate,
  FixedTransaction,
  TxInputsBuilder,
  TransactionInput,
  TransactionHash,
  Value,
} from "@emurgo/cardano-serialization-lib-nodejs";
import { mnemonicToEntropy } from "bip39";
import dotenv from "dotenv";

dotenv.config();

const MNEMONIC = process.env.MNEMONIC;
const INPUT_HASH = process.env.INPUT_HASH;
const INPUT_INDEX = Number(process.env.INPUT_INDEX);
const INPUT_AMOUNT = process.env.INPUT_AMOUNT; //lovelace

function harden(num: number): number {
  return 0x80000000 + num;
}

function main(): void {
  const entropy = mnemonicToEntropy(MNEMONIC!);

  const rootKey = Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, "hex"),
    Buffer.from("")
  );

  const accountKey = rootKey
    .derive(harden(1852))
    .derive(harden(1815))
    .derive(harden(0));
  const stakePrivKey = accountKey.derive(2).derive(0);
  const utxoPrivKey = accountKey.derive(0).derive(0);

  const addr = BaseAddress.new(
    NetworkInfo.testnet_preprod().network_id(),
    Credential.from_keyhash(utxoPrivKey.to_public().to_raw_key().hash()),
    Credential.from_keyhash(stakePrivKey.to_public().to_raw_key().hash())
  );

  const linearFee = LinearFee.new(
    BigNum.from_str("44"),
    BigNum.from_str("155381")
  );

  const txBuilderCfg = TransactionBuilderConfigBuilder.new()
    .fee_algo(linearFee)
    .pool_deposit(BigNum.from_str("500000000"))
    .key_deposit(BigNum.from_str("2000000"))
    .max_value_size(4000)
    .max_tx_size(8000)
    .coins_per_utxo_byte(BigNum.from_str("34482"))
    .build();

  const txBuilder = TransactionBuilder.new(txBuilderCfg);

  const drep = DRep.new_always_abstain();
  const voteDelegation = VoteDelegation.new(
    Credential.from_keyhash(stakePrivKey.to_public().to_raw_key().hash()),
    drep
  );

  const certs = Certificates.new();
  certs.add(Certificate.new_vote_delegation(voteDelegation));

  txBuilder.set_certs(certs);

  const txInputsBuilder = TxInputsBuilder.new();
  txInputsBuilder.add_regular_input(
    addr.to_address(),
    TransactionInput.new(TransactionHash.from_hex(INPUT_HASH!), INPUT_INDEX!),
    Value.new(BigNum.from_str(INPUT_AMOUNT!))
  );

  txBuilder.set_inputs(txInputsBuilder);
  txBuilder.add_change_if_needed(addr.to_address());
  const txBody = txBuilder.build();

  const transaction = FixedTransaction.new_from_body_bytes(txBody.to_bytes());

  transaction.sign_and_add_vkey_signature(stakePrivKey.to_raw_key());
  transaction.sign_and_add_vkey_signature(utxoPrivKey.to_raw_key());

  console.log(transaction.to_hex());
}

main();
