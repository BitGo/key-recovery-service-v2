const utxoLib = require('bitgo-utxo-lib');
const EthTx = require('ethereumjs-tx');
const rippleLib = require('ripple-lib');
const rippleKeypairs = require('ripple-keypairs');
const rippleParse = require('ripple-binary-codec');
const fs = require('fs');
const _ = require('lodash');
const BN = require('bignumber.js');
const prompt = require('prompt-sync')();
const utils = require('./utils');

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

const WEI_PER_ETH = new BN(10).pow(18);

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
    const isBech32 = !input.redeemScript;
    const isSegwit = !!input.witnessScript;

    // chain paths come from the SDK with a leading /, which is technically not allowed by BIP32
    if (input.chainPath.startsWith('/')) {
      input.chainPath = input.chainPath.slice(1);
    }

    const derivedHDNode = backupKeyNode.derivePath(input.chainPath);

    console.log(`Signing input ${ i + 1 } of ${ recoveryRequest.inputs.length } with ${ derivedHDNode.neutered().toBase58() } (${ input.chainPath })`);

    if (isBech32) {
      const witnessScript = Buffer.from(input.witnessScript, 'hex');
      const witnessScriptHash = utxoLib.crypto.sha256(witnessScript);
      const prevOutScript = utxoLib.script.witnessScriptHash.output.encode(witnessScriptHash);
      txBuilder.sign(i, derivedHDNode.keyPair, prevOutScript, utxoLib.Transaction.SIGHASH_ALL, input.amount, witnessScript);
    } else {
      const redeemScript = new Buffer(input.redeemScript, 'hex');

      if (isSegwit) {
        const witnessScript = new Buffer(input.witnessScript, 'hex');
        txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_ALL, input.amount, witnessScript)
      } else {
        txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_ALL);
      }
    }
  });

  return txBuilder.build();
};

const handleSignEthereum = function(recoveryRequest, key) {
  const transaction = new EthTx(recoveryRequest.tx);

  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';
  const txData = transaction.data;
  const outputAddress = '0x' + txData.slice(16, 36).toString('hex');
  const outputAmountWei = new BN(txData.slice(36, 68).toString('hex'), 16);
  const outputAmount = outputAmountWei.div(WEI_PER_ETH).toString();

  console.log('Sign Recovery Transaction');
  console.log('=========================');
  console.log(`Backup Key: ${ recoveryRequest.backupKey }`);
  console.log(`Output Address: ${ outputAddress }`);
  console.log(`Output Amount: ${ outputAmount }`);
  console.log(`Custom Message: ${ customMessage }`);
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

  console.log('Please type "go" to confirm: ');
  const confirm = prompt();

  if (confirm !== 'go') {
    throw new Error('recovery aborted');
  }

  const backupHDNode = utxoLib.HDNode.fromBase58(key);
  const backupSigningKey = backupHDNode.getKey().getPrivateKeyBuffer();

  transaction.sign(backupSigningKey);

  return transaction.serialize().toString('hex');
};

const handleSignXrp = function(recoveryRequest, key) {
  const transaction = rippleParse.decode(recoveryRequest.txHex);
  const rippleApi = new rippleLib.RippleAPI();
  const outputAddress = transaction.Destination;
  const outputAmount = transaction.Amount;
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : "None";

  console.log('Sign Recovery Transaction');
  console.log('=========================');
  console.log(`Backup Key: ${ recoveryRequest.backupKey }`);
  console.log(`Output Address: ${ outputAddress }`);
  console.log(`Output Amount: ${ outputAmount }`);
  console.log(`Custom Message: ${ customMessage }`);
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

  console.log('Please type "go" to confirm: ');
  const confirm = prompt();

  if (confirm !== 'go') {
    throw new Error('recovery aborted');
  }

  const backupAddress = rippleKeypairs.deriveAddress(backupKeyNode.getPublicKeyBuffer().toString('hex'));
  const privateKeyHex = backupKeyNode.keyPair.d.toString(16);
  const cosignedTx = utils.signXrpWithPrivateKey(recoveryRequest.txHex, privateKeyHex, { signAs: backupAddress });

  return rippleApi.combine([ recoveryRequest.txHex, cosignedTx.signedTransaction ]).signedTransaction;
};

const handleSign = function(args) {
  const file = args.file;
  const key = args.key;

  const recoveryRequest = JSON.parse(fs.readFileSync(file));
  const coin = recoveryRequest.coin;

  let txHex;

  switch (coin) {
    case 'eth': case 'teth':
      txHex = handleSignEthereum(recoveryRequest, key);
      break;
    case 'xrp': case 'txrp':
      txHex = handleSignXrp(recoveryRequest, key);
      break;
    default:
      txHex = handleSignUtxo(recoveryRequest, key);
      break;
  }

  console.log(`Signed transaction hex: ${txHex}`);

  const filename = file.replace(/\.[^/.]+$/, '') + '.signed.json';
  console.log(`Writing signed transaction to file: ${filename}`);

  const finalRecovery = _.pick(recoveryRequest, ['backupKey', 'coin', 'recoveryAmount']);
  finalRecovery.txHex = txHex;

  fs.writeFileSync(filename, JSON.stringify(finalRecovery, null, 2));
  console.log('Done');
};

module.exports = { handleSign };
