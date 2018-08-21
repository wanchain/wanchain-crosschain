"use strict";

let hashContract = require('../cross_contract/hashContract.js');
let hashXSend = require('./hashXSend.js');
module.exports = class wanHashXSend extends hashXSend
{
    constructor(from,tokenAddress,amount,storeman,EthAddress,gas,gasPrice,crossType,nonce,protocol="",opt="")
    {
        let Contract = new hashContract(tokenAddress,storeman,EthAddress,crossType,'WAN',protocol,opt);
        super(from,tokenAddress,amount,Contract,gas,gasPrice,nonce);

        this.protocol = protocol;
        this.opt = opt;
    }
}