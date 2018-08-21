"use strict";

let hashContract = require('../cross_contract/hashContract.js');
let hashXSend = require('./hashXSend.js');

module.exports = class ethHashXSend extends hashXSend
{
    constructor(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce,protocol="",opt="")
    {
        let Contract = new hashContract(tokenAddress,storeman,wanAddress,crossType,'ETH',protocol,opt);
        super(from,tokenAddress,amount,Contract,gas,gasPrice,nonce);
        if(amount){
            // add by Jacob begin
            //if(protocol === 'E20' && opt==='APPROVE'){
          if(protocol === 'E20' || opt==='APPROVE'){
              this.trans.setValue(0);
            }
            else{
              this.trans.setValue(amount.getWei());
            }
            // add by Jacob end.
        }
        this.ChainType = 'ETH';
        this.protocol = protocol;
        this.opt = opt;
    }
}