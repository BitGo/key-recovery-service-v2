const Promise = require('bluebird');
const co = Promise.coroutine;
const fs = require('fs');
const should = require('should');

const signingTool = require('../app/sign');

describe('Offline Signing Tool', function() {
  it('cosigns a tbtc transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tbtc.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3kqwP8o53swt12u3AwEi1yTC8seNjE35u6QUFahKpLiMB4AyEFrovYK9PMNVCZkNj38zF'
      + 'D6hEqtFbE9GwJYRyCq4SbXXSFe';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('01000000013c04a097aea03836c87f653f6ec50935fe8b5f6f5d9aa2ac87df950b8c9993dd01000000fdfd000'
      + '0483045022100d896e03083ec75f7a4480c6cdc56fffeb461f1f2ea29655c66ae33d3229ac98902207dc0da042c0c9528eee46edf'
      + '779ece9f6f511169280b6eb48fac61b0086f5e7101473044022073e35afe521b7d7d8cf0a4f27b1d967482292ef89fca1178b3'
      + '3f6a1ea3d7495802207fabbaf04c98fb96d5c2eedf1d07f7d6a3b4aa3dcc89ddee764c1f1bee4d1890014c695221022680'
      + '20e4b9ba66e75bd26ba82a652ae65fe4ad210fe14f729cda435034ac16f02102319e705fb148de929a665d7fc8917947482f3'
      + '8d58e479ea08c579a07cbe662c42102080de204b7c9fd097dc795fbb5c5548817b57cd4e422709080f9443a4e12846653a'
      + 'effffffff01f07a01000000000017a91412948e84c16f371f3a3da4399fb7b2a4dfcf50308700000000');
  });

  it('cosigns a tltc transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tltc.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3cfSGWzChgNwXgzQmAGMZMjbbypCHw7RSzP4fQ6XUSK4zg92jBuaBC1KnvaEYgAqnDShZm65Ea'
      + 'vMRxFduzLj619amWFfh66';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('010000000153d3ba21c4544ab19cd5a92cd3ad8c3b80bbe29a54ca8892663edcccbaa4e63901000000fc0'
      + '0473044022045902c47b61b942e42c39f03458445a8e23f041f5661a53deca81a161dc3cc51022003d6de57031cc99759c'
      + 'd7f6c28bd0024d304f8e3b45c425efa3ea49213f0f12a0147304402201fe70379f8b40c0a6ee946bb8b890d0e995d0e21d'
      + 'e55217cd73c55f73edb6186022046633fee2dc8468a3ffd963302f4963d5d7893efe59536e5c7f3c60bda1c700b014c695'
      + '22102a92f274edd61a2f2bdff1895c99d9ef130f8d918d3e77f7e97e15ad933756356210310507c9f57f2eb6c3bf7cb293'
      + '7254f6de9af05f3d8f95b87c8863ae769a7e48a21034eabba4a47b9e5827643de47c8d9fa912fe9e84121bcf6d6def5fb2'
      + 'bfbe14dab53aeffffffff01680498000000000017a914bdfef638f47a37ddb17bbc86e58eafac334620438700000000');
  });

  it('cosigns a tbtc transaction 2', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tbtc2.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3hpCZUBajcwybVzs3PaY1yd3g1jJp52EXd5RQR4yZknY9UULFYh1iqMyMMoNRNrnB93rcwtS1w'
      + '6dfmcheNHMnpRajB4Nsvb';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('01000000000102ef3d46738cda09d808eecd907e265bad016d8c6204a04ebfc8e0b642dc184a3c000000002322'
      + '00207e9034e8fefce1a3db9e7cd3ce4c628c0f2494c0f902b7b9d0fdfcc33af867d5ffffffff1db609cdac5cec69e11727'
      + 'd30e61e6be2e0f043a1e1557f7098a827e012680f5010000002322002009d6b12c1ff53c3b4b7d91d327eb55bde2076c1ec'
      + '516ab216e5ac2906e020bd7ffffffff01fc240c000000000017a914189f34060a9c0f749bf251b245369de0c385ae148704'
      + '0047304402200f0a623f4579dd8847150fb2798b98e8f409b98bf36b77126d23e8ca36a35a2102206ca9ff4696167ccbd8c'
      + '79546ed6895653bc33f929925bf91650c81ae935456f10147304402200592467056486d3676e1574801227f51c2d6b660b6'
      + 'b4c6a32f18bc0ddde3857b02205d4017dcb1757f425063582221a6343f6f57edb492e928b85ddd696e329b8391016952210'
      + '2806d852817d78114e9992059b2203eed834f93caf700d39a614e81df6110bf782102a0a5e1ce8fe2193d9e6ed5c4c8dbe'
      + '5cd8abf9f02db41514293539294205187f2210290d7e1c1ab180cc212d5abf9ad998bc3a3ac1255b88ef585b98d591c2e0e'
      + '6de253ae0400483045022100b94124f225cf543981ebd16615cafe9041f3be515325f6fd466401c47bd8817a0220209db55'
      + '02608c42c0905705dc97e94489a13e53b9c253665dfa4d1f8dfa231ec0147304402201261f08d902ebde978f851e407733a'
      + '6c98d5fc35fcc7483cc2c3480c59cedaac02205c6e5854f634b1f3d47d6a527a64fd06fd2d3fbd7720474955dde64f132b6'
      + 'f420169522103be4454b9f46cf6b3292996146ba38820065285e18833730371fcfb4ab2163dfb2102e602ee9041f2e9c18a'
      + '07687cd0e64c9d05388133561fd4becc6462a94fc7371521038692737059d95e835f1f565ed57c825476be422feffeed106'
      + '11e0c7012b7035d53ae00000000');
  });

  it('cosigns a tltc transaction 2', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tltc2.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K2trFs9LgRBVDGzDk42hLDHUK5qsskazbEhWfBZQnRcq11FCZp1f5F2i4skDXL2wU9R8hbM9FYF'
      + 'Rn36SDQMECnp3g8QErCqf';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('0100000002a78a1ff21efe8ceab2313cc72fac9511cbbb25af813b23410a9d402df1b990b500000000fd'
      + 'fe0000483045022100c425fb29056467a9f2c1d36425af1fffd61ad144054b901bcc8f05e492ae1889022074e347f91d613'
      + '835273dc748914845514c3518898f74db50fb8de101d4a1faed014830450221008d10d818f5a2bb5243fd0f7b2e93073a93'
      + '1aa58e3b1955c84a4cc515f8d90ebf022063e5689c9a7424a0013101273a1b043a4be41d2f5cf5698f81ce3ba215114dca01'
      + '4c695221029c96401cdc64e0770e919e83fa52253a357b8d1b9ce4a71b08e87a2f6f4bf5212103292baef857797fcb2305c'
      + 'd637796d028f546e369011fa21818c91ae5e99454f32102226a4fa945adb0111e485b45165aab1de6fe8ad576e40d0049e6'
      + 'ab977ddda4e953aeffffffffe31818827c8777254590bff08f827dde9a741b2565dbfdc297a2fe56538b457b00000000fdf'
      + 'd0000483045022100e83143cd33f52c03032969aa4b1ef8c00ceec25dbfa789501a5c443ba8c8a9d4022040c6069871e848'
      + '354157e331879aca88dd44a677db4836d3eed7dc853a4fae2e01473044022035add75708e034aa652914aa9c5275a8804bf'
      + '9cd20b248390adddacba0712fe502202e8105656fc71e78946225f74af60b9f70eaa4afc5b49cb69c19b408240be4c7014c'
      + '6952210291aa18f30c870f48af409c0f7718c0e53442a6c5238fe364c3a2c6b218943be5210285c12449fe9bf5b79661db2'
      + '1b6d394291220285a0985e6f3f9cac5aad0ca2fd22103d184ca13c0cb96bcfbde0ef891b1e6290200a43f75cbf1dc80e6c8'
      + '02465d0b4353aeffffffff01c832c3230000000017a914541703db4b42397e985b38993a52dbb5373526c58700000000');
  });

  // function called in transaction: sendMultiSig, see https://bloxy.info/functions/39125215, pre-EIP155
  it('cosigns a teth transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/teth.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3vqGSfKp56taWfrBxApx9p6ySyWqFGXBrfJyDGaUErjpUu6RW7EjKmynii8zzp2b1AWno9JgVevuG3S8DqY'
      + '97GHN59XMBfN';

    const txHex = signingTool.handleSignEthereum(recoveryRequest, key, true);
    txHex.should.equal('f901cb808504a817c8008307a12094e62529532000e86caa241293e7900b56e7ab96c280b90164391252'
      + '15000000000000000000000000e62529532000e86caa241293e7900b56e7ab96c2000000000000000000000000000000000'
      + '000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000c00000'
      + '00000000000000000000000000000000000000000000000000005b99a265000000000000000000000000000000000000000'
      + '000000000000000000000000100000000000000000000000000000000000000000000000000000000000000e00000000000'
      + '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      + '00000000000000000412bc424c10b29d7b0870816ee14fb0215e74242412fd8d4e22669455aba87cbbf58d88f2415bb8540'
      + '08f4935e7675bf9256a22d62aae7fc036c1647d50b1594a31b0000000000000000000000000000000000000000000000000'
      + '00000000000001ba0be623f6295800459da7b2efeaa568710c5d46dcc2eb8b26e46f1fd4b1b945652a05085a3c02c495905'
      + 'e6ce2ac1434a8d0498111021333451d06ff2be9b18ac80d8');
  });

  it('cosigns a txrp transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/txrp.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K4DPz7jw2NUApRfCTKVaH4WWSXXoXy4c1MvFGRoHGYZ5wj3Z1Xm3ExDiyv4Jig6tSZwNPPTZ'
      + 'vWX3ZzLQKU7MMsdHiqsZ7Ky4';

    const txHex = signingTool.handleSignXrp(recoveryRequest, key, true);
    txHex.should.equal('120000228000000024000000042E00000002201B00BC9F9D6140000000004BF35C68400000000000001E'
      + '730081149DF48CA7E5D2324FBCD67E312F55A07C5E165ADC8314AE5BB8482E5845A641171D070E3063047A2A4094F3E0107'
      + '3210279F3E84891AF0EE4C3830D499BB4041C081125BAEDF0F9AE58B41FD1C460111D74463044022079AEF8F874DD1B81DF'
      + 'E950924E379A06DFB48ECB07A2C469AE763F300516A8AA02205F474FC54986A852A678130CED28AE935A9E71C42C72CCF4A'
      + '626F00B0422EEEF81144ABF14DBB052217CBAB34B6EAA125C1CD8960C49E1E01073210393BFB0711058343E24C65C97AC42'
      + 'A2B0D9760B18FC4DB3D6CC89D16C0942A93D74473045022100CDF19E3A1BA93A1E3464C888AF0514E647360DA0FEC315FBD'
      + '46ACE9512143C87022042D003C0039C6B3D06007498ADED96F6FE6889D141459FA6D7EC073CACC69A2181145FAA8EABD43F'
      + '5953F4FD9D834AB0757A9DD970A9E1F1');
  });

  it('cosigns a txlm transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/txlm.json', { encoding: 'utf8' }));
    const key = 'SCXSHAKOXTOL44DTUVRAFGDSUQLG37RZKPTEKSOFJR2FDL65UG35U7GJ';

    const txHex = signingTool.handleSignXlm(recoveryRequest, key, true);
    txHex.should.equal('AAAAACVtf/LWXE+f4Okh0/QKW/1Aez0CnStXwIhIackGZlgvAAAAZACn8r8AAAAEAAAAAAAAAAAAAAABAA'
      + 'AAAAAAAAEAAAAAJW1/8tZcT5/g6SHT9Apb/UB7PQKdK1fAiEhpyQZmWC8AAAAAAAAAF0KBBKgAAAAAAAAAAgl37ZUAAABAbHVx3'
      + 'gkFQI5+amDNjOE23bN5mSIZNS1dTnvNWalZ7UrNZO35Atze6ach3Yde3ouOEY6SdF57lY4hUl7gaAOICRNoxLAAAABAWtmUIWKh'
      + 'eT0n2LbJqF0sMiuN7PIvNYjc4Q/TU36obDNav38Z0bzAMG7d1GAAVRM+m5L7pP2BSMSarEkw9IC8DA==');
  });

  it('cosigns a txlm transaction 2', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/txlm2.json', { encoding: 'utf8' }));
    const key = 'SCYLWD2O3STCBUK5EXJJTJK2UFTO7XMSY6Y4OJX25I7IDSGAQEUCJD23';

    const txHex = signingTool.handleSignXlm(recoveryRequest, key, true);
    txHex.should.equal('AAAAAHEP9lt5a47RHJTy9SOF17o2M9Lih1KWuybKJV3pUSvoAAAAZAARr38AAAAEAAAAAAAAAAAAAAABAA'
      + 'AAAAAAAAEAAAAAaW6ZR+Cl61718Kj1T7SpBJ5p30GX27pVFfYcVNSNu/YAAAAAAAAAG/COr5wAAAAAAAAAApLOXkcAAABA8JygG'
      + 'FMr8/Rz/0rQ9XwnfP/IFyGA6u7fc1YwyZtfaZIV1AN/D2MttqsTzNFQO4y+jjg9xeQL/B9oK3uorfk8AG1x4ngAAABA6CziP3as'
      + 'wxI18X8bg1dZhje0LqgOfrMBc9qrfxEPivSBey/Oro+qrQQgfeKvNIYnvGRuPn2fB/c41GKPM1VtCQ==');
  });

  it('cosigns an eos transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/teos.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K2SGfLqMk9eaSbix4XUqXg2wqXkATpfnQsyvaXBTnEqi71aLSq1rL3qJh32FRrA2VnrfMMEmbN'
      + 'S5xnRCiNSHKdAVR6Ep5Ptx';

    const txHex = signingTool.handleSignEos(recoveryRequest, key, true);
    txHex.should.equal('{"compression":"none","packed_trx":"d3ca235dbed650bc3a64000000'
      + '000100a6823403ea3055000000572d3ccdcd01507551997772734c00000000a8ed323221507551997772734c9052d3d42ec'
      + '9b071a08601000000000004454f53000000000000","signatures":["SIG_K1_JzpSv5pkpzuzg5FqYUAVsrEtPooVCDx5Ls'
      + '3qkpyuSpsZozj6cMCxgz2jYuuqBoLBTRPet62QFoaVVJ6Rrh1YDp64yRMBBy","SIG_K1_K6YVr5Mhgw4JC4vd4r9v2SgLTRTK8'
      + 'JhnuffK8BCMXPBdht77jyoWZHJQzZbwwEvCY4LhTv6Fnnuey1ibnZniJWzrF6y5sZ"]}');
  });

  it('cosigns a trx transaction', co(function *() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/ttrx.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K2SGfLqMk9eaSbix4XUqXg2wqXkATpfnQsyvaXBTnEqi71aLSq1rL3qJh32FRrA2VnrfMMEmbN'
      + 'S5xnRCiNSHKdAVR6Ep5Ptx';

    const txHex = yield signingTool.handleSignTrx(recoveryRequest, key, true);
    txHex.should.equal('{"visible":false,"txID":"26d73a8892e9a5ed6bccc07da7b8113ced08749fcb7b2600bb96a4076'
      + '6eed8da","raw_data":{"contract":[{"parameter":{"value":{"amount":22000000,"owner_address":"41becdc3'
      + '8018e2202ec67679257ba97fce9b3995a4","to_address":"41979719d19c20cb8480ed0f1135285ff14c8dad58"},"type'
      + '_url":"type.googleapis.com/protocol.TransferContract"},"type":"TransferContract"}],"ref_block_bytes'
      + '":"188c","ref_block_hash":"f432b7931e3859cc","expiration":1573078842000,"timestamp":1573075185139},'
      + '"raw_data_hex":"0a02188c2208f432b7931e3859cc4090f5b896e42d5a68080112640a2d747970652e676f6f676c65617'
      + '069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541becdc38018e2202ec6767925'
      + '7ba97fce9b3995a4121541979719d19c20cb8480ed0f1135285ff14c8dad581880e3be0a70f3dbd994e42d","signature"'
      + ':["9d61b1c11b2573c3a90163fa6fdda609d7dcaf89b00fa03b3c89ce756ac9765a323ecf462a8347d3fbd5c1c943f40286'
      + '45f702f818e19594bb23aaa95aa380ae01","e6648a6f6ef9faa4adafbd852bf955515c6dc18d0d391b6d167da35d8f7410'
      + '929f3d59dac0e434d4c07c553a951e0c42fe01f4677d587ae7a226a9d7521a8a7200"]}');
    const tx = JSON.parse(txHex);
    tx.signature.length.should.equal(2);
  }));

  // function called in transaction: sendMultiSigToken, see https://bloxy.info/functions/0dcd7a6c, pre-EIP155
  it('cosigns an erc20 transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/terc.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K2SGfLqMk9eaSbix4XUqXg2wqXkATpfnQsyvaXBTnEqi71aLSq1rL3qJh32FRrA2VnrfMMEmbNS5x'
      + 'nRCiNSHKdAVR6Ep5Ptx';

    const txHex = signingTool.handleSignErc20(recoveryRequest, key, true);
    txHex.should.equal('f901ab018504a817c8008307a12094e4373bda870a2fb794b4f7d7eaa1268810505feb80b901440dcd7a6'
      + 'c000000000000000000000000e4373bda870a2fb794b4f7d7eaa1268810505feb0000000000000000000000000000000000'
      + '000000000000000000000000000001000000000000000000000000945ac907cf021a6bcd07852bb3b8c087051706a900000'
      + '0000000000000000000000000000000000000000000000000005ba031ab0000000000000000000000000000000000000000'
      + '00000000000000000000000900000000000000000000000000000000000000000000000000000000000000c000000000000'
      + '00000000000000000000000000000000000000000000000000041f9538dae46c7eacd1a87757ae9cf8127af4c4762d5de87'
      + '13e004003a60fd8fe649fed115c3a161a65cc030a835f0698d97190cd039b466edeb19a3be8a7a3a781c000000000000000'
      + '000000000000000000000000000000000000000000000001ba09d1f40fe456381545bb9485638e0198d148b3f74a7d7f044b'
      + '3e03475654dc70ba06140d011274d586b0862a867491278785d97824c8944968535585f33062bfe47');
  });

  it('cosigns a tbch transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tbch.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K4Ukycx7HaYoZQCzp8UEczXSjZpRr5EKbnLmnEANj5sWetqzF82SMeSGr8RfUNDE6AXJ2RXvtE'
      + 'EzL4D4RaembeEBDg96528Y';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('020000000238ebf03415130e2f07e33a519c77f785549bc808f0ebdd9da6fd86ea49d0814d00000000f'
      + 'dfd0000473044022100da21c34ef69ec8788b878623f1157a0b569e0200e280a3462b7d59a93e8de9da021f7dbc42221df1'
      + 'b937983eddc29fa48cef9ea442f769a7fbd1a8a55bfa8a32ac41483045022100dcbfcecd4d45e63d0c9e930a071de0e7925'
      + 'fa55db18e13fb73f54ac61ba6b0f70220115afe5084644959c4f53b58b28a1705d36dbc3c3d9ae93cdfcb20db489ce7e041'
      + '4c695221031f4abb75d569c1fe842bb9d02a59c3977f15c8988b738eb5fbca8e8ab47aeba321034aa82a5a678b197a03902'
      + 'd4eb125d5625802519aab9de02adfcfd20d73326bf721039ec5716d5afa6a232ea57592ff3f36a9ad13584a76560bdf8042'
      + '851f5a6ab61d53aefffffffff9f8e95158bc6c641da1d0e08c31a0e2469c179f3413f901a772acc20674ed3901000000fdf'
      + 'd000047304402204f7176f041fba565fa3f65d0a1917d485410f212e5c350a9e8f4e972c4fbe98e02205fe77161ae9e6b0b'
      + 'dd43a4c544e75a07fd3abfffd96b74620a14e0a71bfeccf041483045022100f4b556dd116735d7f14f7d4373b5016efffbf'
      + '974e86c6768f322b9e0b04c6500022078dd4df2c31777de2b1205bae84c4383bd036114ea29c3961ce4449b7e24ec76414c'
      + '6952210244fce96630bf8de47f4082e29d5bc19b0d48b3f4032e2f1f891518193494595921031c1116aaebe7cdf36b477cd'
      + '343d09324041ff2f818788d6d7edc453f4ad5950a210225c71d8e54e730bf8827f9226bdc82b9e5c9c6e029963782fa8a75'
      + '6b32f2c73753aeffffffff010c5189000000000017a91482bd08e1c0ec097453b4c6ab0409b5f9fa6230fe8700000000');
  });

  it('cosigns a zcash transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tzec.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3qsoJZSJteRRZXgNHtAw5sRC1tsSy6U1D7rvKUsTTVewmx77AiAZJngxnEWMw9EcMxid73171'
      + 'mV7mdNFQigNpPPuDSZGULW';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal(
        '0400008085202f89020f0b5e4de0186891e6f05528cf783b4b1d3912b5db54ccc2b6adc7b3d0e0092000000000b50048304'
        + '5022100e744b5db2bb871f98137e0691a337449622cc58ba21e90dda62ded2e65a76288022057a59384c9ccace2bd4233'
        + '3b7d7c3900e826d55a89d08d45e848e78d94f3f7d5014c69522103738278e8d328d5a4f0fc369b9c49d551680d20db5c0'
        + 'be6997637a336964b5a2a2102b8a0a4ea660a24c2430c4e64c0b3f6b86683330aa852b8a47f0c9f98d3a9e67f21023764'
        + 'b4a19de42a5e3fc2d91ad6bdf8f5fcb637dbd0d3cd9258b28d5510347b0f53aeffffffff6aeabeea4a8e68c97eecd6823'
        + '738beaa7ecf19f2988063bccfe0682ec1e7601400000000b500483045022100dcfa5800f986afddfd0d66253987c31c4f'
        + '7b74e7b5b4a4607e8b6a68ee3059610220542c236fa1b7adad7f26df94594ad570c132588f756359bb05c83e48f41ede7'
        + 'a014c695221027b919dc63f04713640e10904587b3b5cbd11f85a0d36c0d96598978f8587dfa0210272c7941f0a14cef6'
        + 'ce1b8d3d6d01826a829af391fb3c280798312d14e20ef50b210311d81eb4601cc7c4b99736471f55cde928f7d4a4201f9'
        + '74be4fc29c53bcf51d353aeffffffff0150f2e50e0000000017a914e1baafe8b024cb09df46b5f9ae292fa4d4c782c687'
        + '00000000000000000000000000000000000000'
    );
  });

  it('cosigns a tbsv transaction', function() {
    const key = 'xprv9s21ZrQH143K314yEDWE3Ufq3fkzBhP3DqVQKqRWikCxJNEhkNtuV7MQYXsq8ycaXHxkvU6d5hzonuekiip'
      + '6pXDZqzHHHoewGgTMHgCaDme';
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tbsv.json'));
    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('0100000001d16772a94f0d82db7803fc73ff445feb6af8c3e079ae20017f9b74eafe8722de0100'
      + '0000fdfd00004730440220246bfa3181e9f85febb3a2aa57ea76069799e3a9677a15cfd3b5ddd9aa17f6a102204abf481bb'
      + 'a634734723a49e3d2b4cefdde8f9bfdbb1ab4ba04b89c53b94faf4c41483045022100871fdfc6122a93736fa83a45530396'
      + '5f0659d0c6ec2cf044c56b1b1ed44c3ac302204abb5243932895f0acaee42fd462f142bef5ece8bff733e6ef580ac865ed7'
      + 'be5414c6952210398f189c1661704865526b9950f1b70632a6a4e8bc9cf2d4df3b98fd59a3716c021021ca598baf3e740f1'
      + 'a017e086f9edff885ea491847ac2413e8250d39c1e3ccd8d21039070d667c42d9eabde8d79fd00eec3a031afca352cd3a00'
      + '2f4369bdc7b94953253aeffffffff0108ef5e010000000017a914b72b1311fada7342116342284880f61464f490e38700000000');
  });

  it('throws error if no transaction hex is provided in recoveryRequest file', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tzec.json', { encoding: 'utf8' }));
    delete recoveryRequest.tx;
    delete recoveryRequest.transactionHex;
    const key = 'xprv9s21ZrQH143K3qsoJZSJteRRZXgNHtAw5sRC1tsSy6U1D7rvKUsTTVewmx77AiAZJngxnEWMw9EcMxid73171'
      + 'mV7mdNFQigNpPPuDSZGULW';
    try {
      signingTool.handleSignUtxo(recoveryRequest, key, true).should.throw();
    } catch (err) {
      err.message.should.equal('The recovery request did not provide a transaction hex');
    }
  });

  it('parses a private key from 24 words and a path', co(function *() {
    const key = 'bone,penalty,bundle,plug,february,roof,rely,angry,inspire,auto,indicate,shell,assist,unhappy,unab'
      + 'le,clarify,pond,check,size,key,donor,midnight,inquiry,avoid';
    const path = 'm/0';
    const xprv = yield signingTool.parseKey(key, 'eth', path);
    xprv.should.equal('xprv9u4GesLhZXFMtAFY2vT1QpXQrgJHRcbTKnw2J1Bqm2m2HpDztvS7D3AwF69fYZnuBJyJQm4v8hegzKY'
      + '3rLCmBgujbZ3sFRzzLT42Z9oTqBt');
  }));

  it('half-signs an ETH transaction', co(function *() {
    const key = 'xprv9s21ZrQH143K2VPbcq9NwP51S43YX67rUG834oU8BvHgvSayfp9DRuPs6xfKThGbHbdaiGNWdyS5LmTc9GdCV'
      + 'CpNUs6wfyaLukHsvVB8PwP';
    const file = './test/transactions/unsigned-teth.json';
    const expectedOut = JSON.parse(fs.readFileSync('./test/transactions/half-signed-teth.json'));

    const args = { file, key, noWrite: true };
    const outFile = yield signingTool.handleSign(args);
    should(outFile.txInfo.sequenceId).not.be.ok();
    delete outFile.txInfo.sequenceId;
    delete outFile.txInfo.hopTransaction;
    outFile.should.deepEqual(expectedOut);
  }));

  it('half-signs an ERC-20 transaction', co(function *() {
    const key = 'xprv9s21ZrQH143K2VPbcq9NwP51S43YX67rUG834oU8BvHgvSayfp9DRuPs6xfKThGbHbdaiGNWdyS5LmTc9GdCV'
      + 'CpNUs6wfyaLukHsvVB8PwP';
    const file = './test/transactions/unsigned-terc.json';
    const expectedOut = JSON.parse(fs.readFileSync('./test/transactions/half-signed-terc.json'));
    const args = { file, key, noWrite: true };
    const outFile = yield signingTool.handleSign(args);
    should(outFile.txInfo.sequenceId).not.be.ok();
    delete outFile.txInfo.sequenceId;
    delete outFile.txInfo.hopTransaction;
    outFile.should.deepEqual(expectedOut);
  }));
});
