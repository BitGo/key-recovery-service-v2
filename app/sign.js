const utxoLib = require('bitgo-utxo-lib');
const prova = require('prova-lib');
const fs = require('fs');
const _ = require('lodash');
const BN = require('bignumber.js');
const prompt = require('prompt-sync')();
const utils = require('./utils');
const bip39 = require('bip39');
const bitgojs = require('bitgo');
let bitgo;

const utxoNetworks = {
  btc: utxoLib.networks.bitcoin,
  ltc: utxoLib.networks.litecoin,
  bch: utxoLib.networks.bitcoincash,
  bsv: utxoLib.networks.bitcoinsv,
  zec: utxoLib.networks.zcash,
  dash: utxoLib.networks.dash,
  tltc: utxoLib.networks.litecoin,
  tbtc: utxoLib.networks.testnet,
  tbch: utxoLib.networks.bitcoincashTestnet,
  tbsv: utxoLib.networks.bitcoinsvTestnet,
  tzec: utxoLib.networks.zcashTest,
  tdash: utxoLib.networks.dashTest,
};

const coinDecimals = {
  btc: 8,
  eth: 18,
  xrp: 6,
  bch: 8,
  bsv: 8,
  ltc: 8,
  zec: 8,
  dash: 8,
  xlm: 7,
  tbtc: 8,
  teth: 18,
  txrp: 6,
  tltc: 8,
  txlm: 7,
  tbch: 8,
  tbsv: 8,
  tzec: 8,
  tdash: 8,
};

const BCH_COINS = ['bch', 'tbch', 'bsv', 'tbsv'];
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

const getHDNodeAndVerify = function(xprv, expectedXpub) {
  let node;

  try {
    node = utxoLib.HDNode.fromBase58(xprv);
  } catch (e) {
    throw new Error('invalid private key');
  }

  if (node.toBase58() === node.neutered().toBase58()) {
    throw new Error('please provide the private (not public) wallet key');
  }

  if (node.neutered().toBase58() !== expectedXpub) {
    throw new Error('provided private key does not match public key specified with recovery request');
  }

  return node;
};

const handleSignUtxo = function(recoveryRequest, key, skipConfirm) {
  const network = utxoNetworks[recoveryRequest.coin];
  const decimals = coinDecimals[recoveryRequest.coin];

  if (!network) {
    throw new Error(`Unsupported coin: ${recoveryRequest.coin}`);
  }

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = utxoLib.Transaction.fromHex(txHex, network);

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

  const backupKeyNode = getHDNodeAndVerify(key, recoveryRequest.backupKey);

  // force override network as we use btc mainnet xpubs for all utxo coins
  backupKeyNode.keyPair.network = network;

  transaction.ins.forEach(function (input, i) {
    transaction.ins[i].value = recoveryRequest.inputs[i].amount;
  })

  const txBuilder = utxoLib.TransactionBuilder.fromTransaction(transaction, network);

  _.forEach(recoveryRequest.inputs, function(input, i) {

    // Set up chain path: chain paths come from the SDK with a leading /, which is technically not allowed by BIP32
    if (input.chainPath.startsWith('/')) {
      input.chainPath = input.chainPath.slice(1);
    }

    // Derive signing key from chain path
    const derivedHDNode = backupKeyNode.derivePath(input.chainPath);
    console.log(`Signing input ${ i + 1 } of ${ recoveryRequest.inputs.length } with ${ derivedHDNode.neutered().toBase58() } (${ input.chainPath })`);

    // Handle BCH
    if (BCH_COINS.includes(recoveryRequest.coin)) {
      const redeemScript = new Buffer(input.redeemScript, 'hex');
      txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_BITCOINCASHBIP143 | utxoLib.Transaction.SIGHASH_ALL, input.amount);
      return; // in a Lodash forEach loop, 'return' operates like 'continue' does in a regular javascript loop. It finishes this iteration and moves to the next iteration
    }

    // Handle Bech32
    if (!input.redeemScript) {
      const witnessScript = Buffer.from(input.witnessScript, 'hex');
      const witnessScriptHash = utxoLib.crypto.sha256(witnessScript);
      const prevOutScript = utxoLib.script.witnessScriptHash.output.encode(witnessScriptHash);
      txBuilder.sign(i, derivedHDNode.keyPair, prevOutScript, utxoLib.Transaction.SIGHASH_ALL, input.amount, witnessScript);
      return;
    }

    // Handle Wrapped Segwit
    const redeemScript = new Buffer(input.redeemScript, 'hex');
    if (input.witnessScript) {
      const witnessScript = new Buffer(input.witnessScript, 'hex');
      txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_ALL, input.amount, witnessScript);
      return;
    }

    // Handle all other requests
    txBuilder.sign(i, derivedHDNode.keyPair, redeemScript, utxoLib.Transaction.SIGHASH_ALL, input.amount);
  });

  return txBuilder.build().toHex();
};

const handleHalfSignEth = function(recoveryRequest, key, skipConfirm, basecoin) {
  return utils.halfSignEthTransaction(basecoin, recoveryRequest, key);
}

const handleSignEthereum = function(recoveryRequest, key, skipConfirm) {
  const EthTx = require('ethereumjs-tx');

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = new EthTx(txHex);
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

  const backupKeyNode = getHDNodeAndVerify(key, recoveryRequest.backupKey);

  const backupSigningKey = backupKeyNode.keyPair.getPrivateKeyBuffer();

  transaction.sign(backupSigningKey);

  return transaction.serialize().toString('hex');
};

const handleSignXrp = function(recoveryRequest, key, skipConfirm) {
  const rippleLib = require('ripple-lib');
  const rippleApi = new rippleLib.RippleAPI();
  const rippleKeypairs = require('ripple-keypairs');
  const rippleParse = require('ripple-binary-codec');

  const txHex = getTransactionHexFromRequest(recoveryRequest);

  const decimals = coinDecimals[recoveryRequest.coin];
  const transaction = rippleParse.decode(txHex);
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';

  const outputs = [{
    address: transaction.Destination,
    amount: (new BN(transaction.Amount)).div(TEN.pow(decimals))
  }];

  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

  if (!key) {
    console.log('Please enter the xprv of the wallet for signing: ');
    key = prompt();
  }

  const backupKeyNode = getHDNodeAndVerify(key, recoveryRequest.backupKey);

  const backupAddress = rippleKeypairs.deriveAddress(backupKeyNode.keyPair.getPublicKeyBuffer().toString('hex'));
  const privateKeyHex = backupKeyNode.keyPair.getPrivateKeyBuffer().toString('hex');
  const cosignedTx = utils.signXrpWithPrivateKey(txHex, privateKeyHex, { signAs: backupAddress });

  return rippleApi.combine([ txHex, cosignedTx.signedTransaction ]).signedTransaction;
};

const handleSignXlm = function(recoveryRequest, key, skipConfirm) {
  const stellar = require('stellar-base');

  if (recoveryRequest.coin === 'xlm') {
    stellar.Network.usePublicNetwork();
  } else {
    stellar.Network.useTestNetwork();
  }

  const decimals = coinDecimals[recoveryRequest.coin];

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = new stellar.Transaction(txHex);
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';

  if (transaction.operations.length !== 1) {
    throw new Error('Recovery transaction is trying to perform multiple operations - aborting');
  }

  if (transaction.operations[0].type !== 'payment' && transaction.operations[0].type !== 'createAccount') {
    throw new Error('Recovery transaction is not a payment or createAccount transaction - aborting');
  }

  const outputs = [{
    address: transaction.operations[0].destination,
    amount: transaction.operations[0].amount || transaction.operations[0].startingBalance
  }];

  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

  if (!key) {
    console.log('Please enter the private key of the wallet for signing: ');
    key = prompt();
  }

  let backupKeypair;

  try {
    backupKeypair = stellar.Keypair.fromSecret(key);
  } catch (e) {
    throw new Error('invalid private key');
  }

  if (backupKeypair.publicKey() !== recoveryRequest.backupKey) {
    throw new Error('provided private key does not match public key specified with recovery request');
  }

  transaction.sign(stellar.Keypair.fromSecret(key));

  return transaction.toEnvelope().toXDR('base64');
};

const handleSignErc20 = function(recoveryRequest, key, skipConfirm) {
  const EthTx = require('ethereumjs-tx');

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = new EthTx(txHex);

  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';
  const txData = transaction.data;
  const outputs = [{
    address: '0x' + txData.slice(16, 36).toString('hex'),
    amount: new BN(txData.slice(36, 68).toString('hex'), 16)
  }];

  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

  if (!key) {
    console.log('Please enter the xprv of the wallet for signing: ');
    key = prompt();
  }

  const backupKeyNode = getHDNodeAndVerify(key, recoveryRequest.backupKey);

  const backupSigningKey = backupKeyNode.keyPair.getPrivateKeyBuffer();

  transaction.sign(backupSigningKey);

  return transaction.serialize().toString('hex');
};

/* *
  Takes in either an xprv, xlmsecret, or 24 words.
  Returns an xprv or xlmsecret
 */
const parseKey = function(rawkey, coin, path) {

  if(rawkey.includes(',') && rawkey.split(',').length === 24) {
    const mnemonic = rawkey.replace(/,/g,' '); // replace commas with spaces
    if(coin === 'xlm' || coin === 'txlm') {
      // stellar is special (thanks Jeb)
      const stellarWallet = stellarHd.fromMnemonic(mnemonic);
      return stellarWallet.getSecret(0);
    }

    // every other coin can use xpubs
    if(!bip39.validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic");
    }
    const seed = bip39.mnemonicToSeed(mnemonic);
    let node = utxoLib.HDNode.fromSeedBuffer(seed);
    if(path) {
      node = node.derivePath(path);
    }
    const xprv = node.toBase58();
    return xprv;

  }
  // if it doesn't have commas, we expect it is an xprv or xlmsecret properly formatted
  if(path) {
    let node = utxoLib.HDNode.fromPrivateKeyBuffer(Buffer.from(rawkey, 'hex'));
    node = node.derivePath(path);
    return node.toBase58();
  }
  return rawkey;
}

/**
 Not all recoveryRequest files are formatted the same. Sometimes they have 'tx', 'txHex', or 'transactionHex'
 This function gets and gets and returns the transaction hex in all of these cases
 */
const getTransactionHexFromRequest = function(recoveryRequest) {
  if (recoveryRequest.txHex){
    return recoveryRequest.txHex
  }
  if (recoveryRequest.transactionHex){
    return recoveryRequest.transactionHex
  }
  if (recoveryRequest.tx){
    return recoveryRequest.tx
  }
  throw new Error("The recovery request did not provide a transaction hex");
}

const handleSign = function(args) {
  const file = args.file;

  const recoveryRequest = JSON.parse(fs.readFileSync(file, { encoding: 'utf8' }));
  let coin = recoveryRequest.coin;

  if (coin.startsWith('t')) {
    bitgo = new bitgojs.BitGo({ env: 'test' });
  } else {
    console.log('prod');
    bitgo = new bitgojs.BitGo({ env: 'prod' });
  }

  if(!args.key) {
    console.log("\nEnter your private key for signing.\nEnter an xprv or 24 words.\nIf entering 24 words, separate each word with only a comma and no spaces.\n");
    args.key = prompt("Key: ");
  }

  const key = parseKey(args.key, coin, args.path);

  let txHex, halfSignedInfo;

  // If a tokenContractAddress was provided, use that. Otherwise use the named coin
  const basecoin = recoveryRequest.tokenContractAddress ? bitgo.coin(recoveryRequest.tokenContractAddress) : bitgo.coin(coin);

  switch (basecoin.getFamily()) {
    case 'eth':
      if (recoveryRequest.txPrebuild) {
        halfSignedInfo = handleHalfSignEth(recoveryRequest, key, args.confirm, basecoin);
      } else {
        if (coin.getChain() === 'eth' || coin.getChain() === 'teth') {
          txHex = handleSignEthereum(recoveryRequest, key, args.confirm);
        } else {
          txHex = handleSignErc20(recoveryRequest, key, args.confirm, basecoin);
        }
      }
      break;
    case 'xrp':
      txHex = handleSignXrp(recoveryRequest, key, args.confirm);
      break;
    case 'xlm':
      txHex = handleSignXlm(recoveryRequest, key, args.confirm);
      break;
    default:
      txHex = handleSignUtxo(recoveryRequest, key, args.confirm);
      break;
  }

  if(txHex) {
    console.log(`Signed transaction hex: ${txHex}`);
  }

  const filename = file.replace(/\.[^/.]+$/, '') + '.signed.json';
  console.log(`Writing signed transaction to file: ${filename}`);

  let finalRecovery;

  if (txHex) {
    finalRecovery = _.pick(recoveryRequest, ['backupKey', 'coin', 'recoveryAmount']);
    finalRecovery.txHex = txHex;
  } else {
    finalRecovery = halfSignedInfo;
  }

  const fileStr = JSON.stringify(finalRecovery, null, 2);
  if(!args.noWrite) {
    fs.writeFileSync(filename, fileStr);
    console.log('Done');
  }
  return finalRecovery;
};

module.exports = { handleSign, handleSignUtxo, handleSignEthereum, handleSignXrp, handleSignXlm, handleSignErc20, parseKey };
