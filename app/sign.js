const utxoLib = require('bitgo-utxo-lib');
const fs = require('fs');
const _ = require('lodash');
const prompt = require('prompt-sync')();

const utxoNetworks = {
  btc: utxoLib.networks.bitcoin,
  ltc: utxoLib.networks.litecoin,
  bch: utxoLib.networks.bitcoincash,
  zec: utxoLib.networks.zcash,
  tltc: utxoLib.networks.litecoin,
  tbtc: utxoLib.networks.testnet
};

const coinDecimals = {
  btc: 8,
  ltc: 8,
  bch: 8,
  zec: 8,
  tbtc: 8,
  tltc: 8,
  eth: 18
};

const handleSignUtxo = function(recoveryRequest, key) {
  const network = utxoNetworks[recoveryRequest.coin];
  const decimals = coinDecimals[recoveryRequest.coin];

  if (!network) {
    throw new Error(`Unsupported coin: ${recoveryRequest.coin}`);
  }

  const transaction = utxoLib.Transaction.fromHex(recoveryRequest.transactionHex, network);
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';

  console.log('Sign Recovery Transaction');
  console.log('=========================');
  console.log(`Backup Key: ${recoveryRequest.backupKey}`);
  _.forEach(transaction.outs, function(output) {
    const address = utxoLib.address.fromOutputScript(output.script, network);

    console.log(`Output Address: ${address}`);
    console.log(`Output Amount: ${(output.value / Math.pow(10, decimals)).toFixed(6)}`);
  });
  console.log(`Custom Message: ${customMessage}`);
  console.log('=========================');

  if (!key) {
    console.log('Please enter the xprv of the wallet for signing: ');
    key = prompt();
  }

  let backupKeyNode;

  try {
    backupKeyNode = utxoLib.HDNode.fromBase58(key);
  } catch (e) {
    throw new Error('invalid private key');
  }

  if (backupKeyNode.toBase58() === backupKeyNode.neutered().toBase58()) {
    throw new Error('please provide the private (not public) wallet key');
  }

  if (backupKeyNode.neutered().toBase58() !== recoveryRequest.backupKey) {
    throw new Error('provided private key does not match public key specified with recovery request');
  }

  // force override network as we use btc mainnet xpubs for all utxo coins
  backupKeyNode.keyPair.network = network;

  console.log('Please type "go" to confirm: ');
  const confirm = prompt();

  if (confirm !== 'go') {
    throw new Error('recovery aborted');
  }

  const txBuilder = utxoLib.TransactionBuilder.fromTransaction(transaction, network);

  _.forEach(recoveryRequest.inputs, function(input, i) {
    const isSegwit = !!input.witnessScript;

    // chain paths come from the SDK with a leading /, which is technically not allowed by BIP32
    if (input.chainPath.startsWith('/')) {
      input.chainPath = input.chainPath.slice(1);
    }

    const derivedHDNode = backupKeyNode.derivePath(input.chainPath);

    const redeemScript = new Buffer(input.redeemScript, 'hex');
    console.log(`Signing input ${ i + 1 } of ${ recoveryRequest.inputs.length } with ${ derivedHDNode.neutered().toBase58() } (${ input.chainPath })`);

    if (isSegwit) {
      const witnessScript = new Buffer(input.witnessScript, 'hex');
      txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_ALL, input.amount, witnessScript)
    } else {
      txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_ALL);
    }
  });

  const signedTx = txBuilder.build();
  console.log(`Signed transaction hex: ${signedTx.toHex()}`);
  console.log('==================');

  return signedTx.toHex();
};

const handleSign = function(args) {
  const file = args.file;
  const key = args.key;

  const recoveryRequest = JSON.parse(fs.readFileSync(file));
  const coin = recoveryRequest.coin;

  let txHex;

  switch (coin) {
    case 'eth':
      txHex = handleSignEthereum(recoveryRequest, key);
      break;
    default:
      txHex = handleSignUtxo(recoveryRequest, key);
      break;
  }

  const filename = file.replace(/\.[^/.]+$/, '') + '.signed.json';
  console.log(`Writing signed transaction to file: ${filename}`);

  const finalRecovery = _.pick(recoveryRequest, ['backupKey', 'coin', 'recoveryAmount']);
  finalRecovery.txHex = txHex;

  fs.writeFileSync(filename, JSON.stringify(finalRecovery, null, 2));
  console.log('Done');
};

module.exports = { handleSign };
