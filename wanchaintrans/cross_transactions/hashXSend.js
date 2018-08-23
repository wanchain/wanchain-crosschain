"use strict";

let TokenSend = require("../interface/transaction.js").TokenSend;
module.exports = class hashXSend extends TokenSend
{
    constructor(from,tokenAddress,amount,contract,gas,gasPrice,nonce)
    {
        super(from,tokenAddress,gas,gasPrice,nonce);
        this.Contract = contract;
        this.Amount = amount;
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
        console.log("setLockData this.ChainType :" ,this.ChainType);
      console.log("setLockData this.trans.opt :" ,this.trans.opt);
      console.log("setLockData this.opt :" ,this.opt);
        if(this.ChainType === 'ETH'){
            //this.trans.setData(this.Contract.getLockData());
          // add by jacob begin
          if(this.opt === 'APPROVE' || this.protocol === 'E20'){
            console.log("setLockData this.app_value :" ,this.app_value);
            this.Contract.app_value=this.Amount;
            this.Contract.E20_from = this.trans.from;
          }
          this.trans.setData(this.Contract.getLockData());
          // add by jacob end
        }
        else
        {
          if(this.opt === 'APPROVE' || this.protocol === 'E20'){
            console.log("setLockData this.app_value WAN:" ,this.app_value);
            this.Contract.app_value=this.Amount;
            this.Contract.E20_from = this.trans.from;
          }
            this.trans.setData(this.Contract.getLockData(this.Amount));
        }
    }
    setRefundData(){
        this.trans.setData(this.Contract.getRefundData());
    }
    setRevokeData(){
        this.trans.setData(this.Contract.getRevokeData());
    }
}