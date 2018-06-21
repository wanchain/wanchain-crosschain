let hashContract = require('../cross_contract/hashContract.js');
let hashXSend = require('./hashXSend.js');
module.exports = class wanHashXSend extends hashXSend
{
    constructor(from,tokenAddress,amount,storeman,EthAddress,gas,gasPrice,crossType,nonce)
    {
        let Contract = new hashContract(tokenAddress,storeman,EthAddress,crossType,'WAN');
        super(from,tokenAddress,amount,Contract,gas,gasPrice,nonce);
    }
}