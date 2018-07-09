"use strict";

let hashContract = require('../cross_contract/hashContract.js');
let hashXSend = require('./hashXSend.js');

module.exports = class ethHashXSend extends hashXSend
{
    constructor(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce)
    {
        let Contract = new hashContract(tokenAddress,storeman,wanAddress,crossType,'ETH');
        super(from,tokenAddress,amount,Contract,gas,gasPrice,nonce);
        if(amount){
            this.trans.setValue(amount.getWei());
        }
        this.ChainType = 'ETH';
    }
}