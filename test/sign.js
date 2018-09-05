const fs = require('fs');
const should = require('should');

const signingTool = require('../app/sign');

describe('Offline Signing Tool', function() {
  it('cosigns a tbtc transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tbtc.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3kqwP8o53swt12u3AwEi1yTC8seNjE35u6QUFahKpLiMB4AyEFrovYK9PMNVCZkNj38zFD6hEqtFbE9GwJYRyCq4SbXXSFe';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('01000000013c04a097aea03836c87f653f6ec50935fe8b5f6f5d9aa2ac87df950b8c9993dd01000000fdfd0000483045022100d896e03083ec75f7a4480c6cdc56fffeb461f1f2ea29655c66ae33d3229ac98902207dc0da042c0c9528eee46edf779ece9f6f511169280b6eb48fac61b0086f5e7101473044022073e35afe521b7d7d8cf0a4f27b1d967482292ef89fca1178b33f6a1ea3d7495802207fabbaf04c98fb96d5c2eedf1d07f7d6a3b4aa3dcc89ddee764c1f1bee4d1890014c69522102268020e4b9ba66e75bd26ba82a652ae65fe4ad210fe14f729cda435034ac16f02102319e705fb148de929a665d7fc8917947482f38d58e479ea08c579a07cbe662c42102080de204b7c9fd097dc795fbb5c5548817b57cd4e422709080f9443a4e12846653aeffffffff01f07a01000000000017a91412948e84c16f371f3a3da4399fb7b2a4dfcf50308700000000');
  });

  it('cosigns a tltc transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/tltc.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3cfSGWzChgNwXgzQmAGMZMjbbypCHw7RSzP4fQ6XUSK4zg92jBuaBC1KnvaEYgAqnDShZm65EavMRxFduzLj619amWFfh66';

    const txHex = signingTool.handleSignUtxo(recoveryRequest, key, true);
    txHex.should.equal('010000000153d3ba21c4544ab19cd5a92cd3ad8c3b80bbe29a54ca8892663edcccbaa4e63901000000fc00473044022045902c47b61b942e42c39f03458445a8e23f041f5661a53deca81a161dc3cc51022003d6de57031cc99759cd7f6c28bd0024d304f8e3b45c425efa3ea49213f0f12a0147304402201fe70379f8b40c0a6ee946bb8b890d0e995d0e21de55217cd73c55f73edb6186022046633fee2dc8468a3ffd963302f4963d5d7893efe59536e5c7f3c60bda1c700b014c69522102a92f274edd61a2f2bdff1895c99d9ef130f8d918d3e77f7e97e15ad933756356210310507c9f57f2eb6c3bf7cb2937254f6de9af05f3d8f95b87c8863ae769a7e48a21034eabba4a47b9e5827643de47c8d9fa912fe9e84121bcf6d6def5fb2bfbe14dab53aeffffffff01680498000000000017a914bdfef638f47a37ddb17bbc86e58eafac334620438700000000');
  });

  it('cosigns a teth transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/teth.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K3vqGSfKp56taWfrBxApx9p6ySyWqFGXBrfJyDGaUErjpUu6RW7EjKmynii8zzp2b1AWno9JgVevuG3S8DqY97GHN59XMBfN';

    const txHex = signingTool.handleSignEthereum(recoveryRequest, key, true);
    txHex.should.equal('f901cb808504a817c8008307a12094e62529532000e86caa241293e7900b56e7ab96c280b9016439125215000000000000000000000000e62529532000e86caa241293e7900b56e7ab96c2000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000005b99a265000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000412bc424c10b29d7b0870816ee14fb0215e74242412fd8d4e22669455aba87cbbf58d88f2415bb854008f4935e7675bf9256a22d62aae7fc036c1647d50b1594a31b000000000000000000000000000000000000000000000000000000000000001ba0be623f6295800459da7b2efeaa568710c5d46dcc2eb8b26e46f1fd4b1b945652a05085a3c02c495905e6ce2ac1434a8d0498111021333451d06ff2be9b18ac80d8');
  });

  it('cosigns a txrp transaction', function() {
    const recoveryRequest = JSON.parse(fs.readFileSync('./test/transactions/txrp.json', { encoding: 'utf8' }));
    const key = 'xprv9s21ZrQH143K4DPz7jw2NUApRfCTKVaH4WWSXXoXy4c1MvFGRoHGYZ5wj3Z1Xm3ExDiyv4Jig6tSZwNPPTZvWX3ZzLQKU7MMsdHiqsZ7Ky4';

    const txHex = signingTool.handleSignXrp(recoveryRequest, key, true);
    txHex.should.equal('120000228000000024000000042E00000002201B00BC9F9D6140000000004BF35C68400000000000001E730081149DF48CA7E5D2324FBCD67E312F55A07C5E165ADC8314AE5BB8482E5845A641171D070E3063047A2A4094F3E01073210279F3E84891AF0EE4C3830D499BB4041C081125BAEDF0F9AE58B41FD1C460111D74463044022079AEF8F874DD1B81DFE950924E379A06DFB48ECB07A2C469AE763F300516A8AA02205F474FC54986A852A678130CED28AE935A9E71C42C72CCF4A626F00B0422EEEF81144ABF14DBB052217CBAB34B6EAA125C1CD8960C49E1E01073210393BFB0711058343E24C65C97AC42A2B0D9760B18FC4DB3D6CC89D16C0942A93D74473045022100CDF19E3A1BA93A1E3464C888AF0514E647360DA0FEC315FBD46ACE9512143C87022042D003C0039C6B3D06007498ADED96F6FE6889D141459FA6D7EC073CACC69A2181145FAA8EABD43F5953F4FD9D834AB0757A9DD970A9E1F1');
  });
});
