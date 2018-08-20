"use strict";

let TokenSend = require("../interface/transaction.js").TokenSend;
module.exports = class hashXSend extends TokenSend
{
    constructor(from,tokenAddress,amount,contract,gas,gasPrice,nonce)
    {
        super(from,tokenAddress,gas,gasPrice,nonce);
        this.Contract = contract;
        this.amount = amount;
    }
    setKey(key){
        this.Contract.setKey(key);
    }
    setTokenAddress(tokenAddress){
        this.to = tokenAddress;
        this.Contract.setTokenAddress(tokenAddress);
    }
    setValue(v){
        this.trans.setValue(v);
    }
    setLockData(){
        if(this.ChainType == 'ETH'){
            this.trans.setData(this.Contract.getLockData());
        }
        else
        {
            this.trans.setData(this.Contract.getLockData(this.amount));
        }
    }
    setRefundData(){
        this.trans.setData(this.Contract.getRefundData());
    }
    setRevokeData(){
        this.trans.setData(this.Contract.getRevokeData());
    }
}