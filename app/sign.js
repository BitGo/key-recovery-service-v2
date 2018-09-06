const utxoLib = require('bitgo-utxo-lib');
const prova = require('prova-lib');
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
  eth: 18,
  xrp: 6,
  bch: 8,
  ltc: 8,
  zec: 8,
  tbtc: 8,
  teth: 18,
  txrp: 6,
  tltc: 8
};

const TEN = new BN(10);

const confirmRecovery = function(backupKey, outputs, customMessage, skipConfirm) {
  console.log('Sign Recovery Transaction');
  console.log('=========================');
  console.log(`Backup Key: ${ backupKey }`);
  _.forEach(outputs, function(out) {
    console.log(`Output Address: ${out.address}`);
    console.log(`Output Amount: ${out.amount}`);
  });
  console.log(`Custom Message: ${customMessage}`);
  console.log('=========================');

  if (!skipConfirm) {
    console.log('Please type "go" to confirm: ');
    const confirm = prompt();

    if (confirm !== 'go') {
      throw new Error('recovery aborted');
    }
  }
};

const handleSignUtxo = function(recoveryRequest, key, skipConfirm) {
  const network = utxoNetworks[recoveryRequest.coin];
  const decimals = coinDecimals[recoveryRequest.coin];

  if (!network) {
    throw new Error(`Unsupported coin: ${recoveryRequest.coin}`);
  }

  const transaction = utxoLib.Transaction.fromHex(recoveryRequest.transactionHex, network);

  const outputs = transaction.outs.map(out => ({
    address: utxoLib.address.fromOutputScript(out.script, network),
    amount: ( new BN(out.value) ).div( TEN.pow(decimals) ).toString()
  }));
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';
  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

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

  return txBuilder.build().toHex();
};

const handleSignEthereum = function(recoveryRequest, key, skipConfirm) {
  const transaction = new EthTx(recoveryRequest.tx);
  const decimals = coinDecimals[recoveryRequest.coin];

  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';
  const txData = transaction.data;
  const outputs = [{
    address: '0x' + txData.slice(16, 36).toString('hex'),
    amount: (new BN(txData.slice(36, 68).toString('hex'), 16)).div(TEN.pow(decimals))
  }];

  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

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

  const backupHDNode = prova.HDNode.fromBase58(key);
  const backupSigningKey = backupHDNode.getKey().getPrivateKeyBuffer();

  transaction.sign(backupSigningKey);

  return transaction.serialize().toString('hex');
};

const handleSignXrp = function(recoveryRequest, key, skipConfirm) {
  const decimals = coinDecimals[recoveryRequest.coin];
  const transaction = rippleParse.decode(recoveryRequest.txHex);
  const rippleApi = new rippleLib.RippleAPI();
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : "None";

  const outputs = [{
    address: transaction.Destination,
    amount: (new BN(transaction.Amount)).div(TEN.pow(decimals))
  }];

  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

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

  const backupAddress = rippleKeypairs.deriveAddress(backupKeyNode.getPublicKeyBuffer().toString('hex'));
  const privateKeyHex = backupKeyNode.keyPair.d.toString(16);
  const cosignedTx = utils.signXrpWithPrivateKey(recoveryRequest.txHex, privateKeyHex, { signAs: backupAddress });

  return rippleApi.combine([ recoveryRequest.txHex, cosignedTx.signedTransaction ]).signedTransaction;
};

const handleSign = function(args) {
  const file = args.file;
  const key = args.key;

  const recoveryRequest = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
  const coin = recoveryRequest.coin;

  let txHex;

  switch (coin) {
    case 'eth': case 'teth':
      txHex = handleSignEthereum(recoveryRequest, key, args.confirm);
      break;
    case 'xrp': case 'txrp':
      txHex = handleSignXrp(recoveryRequest, key, args.confirm);
      break;
    default:
      txHex = handleSignUtxo(recoveryRequest, key, args.confirm);
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

module.exports = { handleSign, handleSignUtxo, handleSignEthereum, handleSignXrp };
