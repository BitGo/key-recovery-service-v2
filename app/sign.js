const utxoLib = require('bitgo-utxo-lib');
const accountLib = require('@bitgo/account-lib');
const statics = require('@bitgo/statics');
const prova = require('prova-lib');
const fs = require('fs');
const _ = require('lodash');
const BN = require('bignumber.js');
const prompt = require('prompt-sync')();
const utils = require('./utils');
const bip39 = require('bip39');
const bitgojs = require('bitgo');
let bitgo;


const BCH_COINS = ['bch', 'tbch', 'bsv', 'tbsv'];
const TEN = new BN(10);

const EOS_MAINNET_CHAIN_ID = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
const EOS_TESTNET_CHAIN_ID = 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473';

const getCoinConfig = function(coin, data) {
  return statics.coins.get[coin].[data];
}

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

/**
 * Verifies that input is a valid HD key and parses it into HDNode object.
 * @param xprv Base58 representation of extended private key
 * @param expectedXpub The corresponding extended public key
 * @returns The HDNode object representing the extended private key
 */
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

/**
 * Prints the recovery transaction information and prompt the user for the confirmation as well as the key, if needed to.
 * @param recoveryRequest The recovery transansaction request object.
 * @param outputs The outputs of the transaction.
 * @param skipConfirm The boolean value that indicates to whether or not to prompt the user to confirm the transaction.
 * @param [key] The provided private key of the wallet.
 * @returns The private key of the wallet.
 */
const promptForConfirmationAndKey = function(recoveryRequest, outputs, skipConfirm, key) {
  const customMessage = recoveryRequest.custom ? recoveryRequest.custom.message : 'None';
  confirmRecovery(recoveryRequest.backupKey, outputs, customMessage, skipConfirm);

  if (!key) {
    console.log('Please enter the xprv of the wallet for signing: ');
    key = prompt();
  }

  return key;
}

/**
 * Gets the backup private key that can be used to sign the transaction.
 * @param xprv The provided extended private key (BIP32).
 * @param expectedXpub The public key specified with the request. 
 * @returns The private key to sign the transaction.
 */
const getBackupSigningKey = function(xprv, expectedXpub) {
  const backupKeyNode = getHDNodeAndVerify(xprv, expectedXpub);

  return backupKeyNode.keyPair.getPrivateKeyBuffer();
}

const handleSignUtxo = function(recoveryRequest, key, skipConfirm) {
  
  const network = getCoinConfig(recoveryRequest.coin, 'network');
  const decimals = getCoinConfig(recoveryRequest.coin, 'decimalPlaces');

  if (!network) {
    throw new Error(`Unsupported coin: ${recoveryRequest.coin}`);
  }

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = utxoLib.Transaction.fromHex(txHex, network);

  const outputs = transaction.outs.map(out => ({
    address: utxoLib.address.fromOutputScript(out.script, network),
    amount: ( new BN(out.value) ).div( TEN.pow(decimals) ).toString()
  }));
  
  key = promptForConfirmationAndKey(recoveryRequest, outputs, skipConfirm, key);

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
  return signEthTx(recoveryRequest, key, skipConfirm, false);
};

/**
 * Signs an Ethereum transaction.
 * @param recoveryRequest The recovery request object.
 * @param key The provided private key of the wallet.
 * @param skipConfirm The boolean value that indicates to whether or not to prompt the user to confirm the transaction.
 * @param isToken The boolean value that indicates if the transaction is for erc20 or ETH.
 * @returns The 'hex' value of the signed transaction.
 */
const signEthTx = function(recoveryRequest, key, skipConfirm, isToken) {
  const EthTx = require('ethereumjs-tx');
  const EthUtil = require('ethereumjs-util');

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = new EthTx(txHex);

  const txData = transaction.data;
  
  const outputs = [{
    address: '0x' + txData.slice(16, 36).toString('hex'),
    amount: new BN(txData.slice(36, 68).toString('hex'), 16)
  }];

  // if request is for ETH, need to correct the amount decimals.
  if (!isToken) {
    const decimals = getCoinConfig(recoveryRequest.coin, 'decimalPlaces');
    
    outputs[0].amount = outputs[0].amount.div(TEN.pow(decimals));
  }

  // When generating signatures, we don't currently use EIP155 but this could
  // be activated if we wanted to. This would protect against replay attacks on other
  // blockchains, such as Ethereum Classic. To activate the EIP155, we would have to
  // know the chain ID of the Ethereum blockchains we are using as this value goes
  // into the V field when using EIP155.
  // cf. https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md
  const useEip155 = false;

  key = promptForConfirmationAndKey(recoveryRequest, outputs, skipConfirm, key);
  const signingKey = Buffer.from(getBackupSigningKey(key, recoveryRequest.backupKey), "hex");
  const signature = EthUtil.ecsign(transaction.hash(useEip155), signingKey, transaction.chainId);
  transaction.v = signature.v; // Change this if activating EIP155
  transaction.r = signature.r;
  transaction.s = signature.s;

  return transaction.serialize().toString('hex');
};

const handleSignTrx = function(recoveryRequest, key, skipConfirm) {
  const coin = recoveryRequest.coin;

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const builder = new accountLib.TransactionBuilder({ coinName: coin });
  builder.from(txHex);

  const outputs = builder.build().destinations.map(d => {
    return {
      address: d.address,
      amount: d.value.toString(10)
    };
  });

  key = promptForConfirmationAndKey(recoveryRequest, outputs, skipConfirm, key);
  const signingKey = getBackupSigningKey(key, recoveryRequest.backupKey);

  builder.sign({ key: signingKey });
  return JSON.stringify(builder.build().toJson());
};

const handleSignEos = function(recoveryRequest, key, skipConfirm) {
  const EosJs = require('eosjs');
  const ecc = require('eosjs-ecc');
  let chainId;
  if (recoveryRequest.coin === 'eos') {
    chainId = EOS_MAINNET_CHAIN_ID;
  } else {
    chainId = EOS_TESTNET_CHAIN_ID;
  }

  const sendableTxJsonString = getTransactionHexFromRequest(recoveryRequest);
  const eosTx = JSON.parse(sendableTxJsonString);
  const packed_trx = eosTx.packed_trx;

  const { recipient, amount } = utils.deserializeEOSTransaction(EosJs, packed_trx);

  const outputs = [{
    address: recipient,
    amount: new BN(amount)
  }];

  key = promptForConfirmationAndKey(recoveryRequest, outputs, skipConfirm, key);

  const dataToSign = utils.getEOSSignatureData(packed_trx, chainId);
  const signBuffer = Buffer.from(dataToSign, 'hex');
  const privateKeyBuffer = getBackupSigningKey(key, recoveryRequest.backupKey);
  const signature = ecc.Signature.sign(signBuffer, privateKeyBuffer).toString();

  eosTx.signatures.push(signature);

  // EOS txHex is a stringified JSON containing the signatures array
  return JSON.stringify(eosTx);
};

const handleSignXrp = function(recoveryRequest, key, skipConfirm) {
  const rippleLib = require('ripple-lib');
  const rippleApi = new rippleLib.RippleAPI();
  const rippleKeypairs = require('ripple-keypairs');
  const rippleParse = require('ripple-binary-codec');

  const txHex = getTransactionHexFromRequest(recoveryRequest);

  const decimals = getCoinConfig(recoveryRequest.coin, 'decimalPlaces');
  const transaction = rippleParse.decode(txHex);

  const outputs = [{
    address: transaction.Destination,
    amount: (new BN(transaction.Amount)).div(TEN.pow(decimals))
  }];

  key = promptForConfirmationAndKey(recoveryRequest, outputs, skipConfirm, key);

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

  const txHex = getTransactionHexFromRequest(recoveryRequest);
  const transaction = new stellar.Transaction(txHex);

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

  key = promptForConfirmationAndKey(recoveryRequest, outputs, skipConfirm, key);

  let backupKeypair;

  try {
    backupKeypair = stellar.Keypair.fromSecret(key);
  } catch (e) {
    throw new Error('invalid private key');
  }

  if (backupKeypair.publicKey() !== recoveryRequest.backupKey) {
    throw new Error('provided private key does not match public key specified with recovery request');
  }

  transaction.sign(backupKeypair);

  return transaction.toEnvelope().toXDR('base64');
};

const handleSignErc20 = function(recoveryRequest, key, skipConfirm) {
  return signEthTx(recoveryRequest, key, skipConfirm, true);
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
  const coin = statics.coins.get(recoveryRequest.coin);

  if (coin.network.type === 'testnet') {
    bitgo = new bitgojs.BitGo({ env: 'test' });
  } else {
    bitgo = new bitgojs.BitGo({ env: 'prod' });
  }

  if(!args.key) {
    console.log("\nEnter your private key for signing.\nEnter an xprv or 24 words.\nIf entering 24 words, separate each word with only a comma and no spaces.\n");
    args.key = prompt("Key: ");
  }

  const key = parseKey(args.key, coin.name, args.path);

  let txHex, halfSignedInfo;

  // If a tokenContractAddress was provided, use that. Otherwise use the named coin
  const basecoin = recoveryRequest.tokenContractAddress ? bitgo.coin(recoveryRequest.tokenContractAddress) : bitgo.coin(coin.name);

  switch (basecoin.getFamily()) {
    case 'eth':
      if (recoveryRequest.txPrebuild) {
        halfSignedInfo = handleHalfSignEth(recoveryRequest, key, args.confirm, basecoin);
      } else {
        if (coin.family === 'eth' && !coin.isToken) {
          txHex = handleSignEthereum(recoveryRequest, key, args.confirm);
        } else {
          txHex = handleSignErc20(recoveryRequest, key, args.confirm);
        }
      }
      break;
    case 'eos':
      txHex = handleSignEos(recoveryRequest, key, args.confirm);
      break;
    case 'trx':
      txHex = handleSignTrx(recoveryRequest, key, args.confirm);
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

module.exports = { handleSign, handleSignUtxo, handleSignEthereum, handleSignXrp, handleSignXlm, handleSignErc20, handleSignEos, handleSignTrx, parseKey };
