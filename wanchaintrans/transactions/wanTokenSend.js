let TokenSend = require("../interface/transaction.js").TokenSend;
let wanContract = require("../contract/contract.js").wanContract;
class wanTokenSend extends TokenSend
{
    constructor(from,to,tokenAddress,CoinAmount,gas,gasPrice,nonce)
    {
        super(from,tokenAddress,gas,gasPrice,nonce);
        this.Contract = new wanContract(tokenAddress);
        this.trans.setData(this.Contract.getData(to,CoinAmount));
    }
}
module.exports = wanTokenSend;