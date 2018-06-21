let TokenSend = require("../interface/transaction.js").TokenSend;
let PrivacyContract = require("../contract/contract.js").PrivacyContract;
let CreateOTAAddress = require("../interface/OTAAddress.js").CreateOTAAddress;
class PrivacySend extends TokenSend
{
    constructor(from,toWaddress,CoinAmount,gas,gasPrice,nonce)
    {
        super(from,null,gas,gasPrice,nonce);
        if(!this.trans.checkWAddress(toWaddress))
        {
            console.log('waddress is error: ' + toWaddress);
            return;
        }
        this.trans.setValue(CoinAmount.getWei());
        this.Contract = new PrivacyContract();
        this.trans.setTo(this.Contract.tokenAddress);
        let otaAddress = new CreateOTAAddress(toWaddress);
        this.trans.setData(this.Contract.getData(otaAddress.waddress,CoinAmount));
    }
}
module.exports = PrivacySend;