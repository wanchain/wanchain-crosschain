'use strict';

const Err_Address =  'Address check error';
let wanUtil = require('wanchain-util');
var Tx = wanUtil.wanchainTx;
let EthTx = require('ethereumjs-tx');
let ethUtil = require('ethereumjs-util');
class ITrans {
    constructor()
    {
        this.Txtype = '0x01';
        this.from = null;
        this.to = null;
        this.value = 0;
        this.gasPrice = 0;
        this.gasLimit = 0;
//        this.data = null;
//        this.nonce = null;
    }
    setTxtype(type)
    {
        this.Txtype = type;
    }
    setFrom(from)
    {
        if(this.checkAddress(from))
        {
            this.from = from;
        }
        else
        {
            console.log(Err_Address + ": " + from);
        }
    }
    setTo(to)
    {
        if(this.checkAddress(to))
        {
            this.to = to;
        }
        else
        {
            console.log(Err_Address + ": " + to);
        }

    }
    setValue(value)
    {
        this.value = value;
    }
    setData(data)
    {
        this.data = data;
    }
    checkAddress(address)
    {
        if(address)
        {
            if(/^0x[0-9a-f]{40}$/.test(address))
                return true;
            if(/^0x[0-9A-F]{40}$/.test(address))
                return true;
            return (wanUtil.toChecksumAddress(address) === address)||(ethUtil.toChecksumAddress(address)===address);
        }
        else
        {
            return true;
        }
    }
    checkWAddress(waddress)
    {
        if(waddress)
        {
            return /^(0x)?[0-9a-fA-F]{132}$/.test(waddress);
        }
        else
        {
            return true;
        }
    }
};
class IRawTransaction
{
    constructor(from,to,gas,gasPrice,nonce)
    {
        this.trans = new ITrans();
        this.trans.setFrom(from);
        this.trans.setTo(to);
        this.trans.gasLimit = Number(gas);
        this.trans.gas = Number(gas);
        console.log(gasPrice); //TODO , what's wrong????
        this.trans.gasPrice = 200000000000;
        this.trans.nonce = nonce;
        this.Account = null;
        this.ChainType = 'WAN';
    }
    setAccount(keystoreDir){
        this.Account = keystoreDir.getAccount(this.trans.from);
    }
    signFunc(privateKey,TxClass){
        const tx = new TxClass(this.trans);
        tx.sign(privateKey);
        const serializedTx = tx.serialize();
        return "0x"+serializedTx.toString('hex');
    }
    sign(privateKey)
    {
        console.log("transaction Sign ChainType : ", this.ChainType);
        if(this.ChainType == 'WAN'){
            return this.signFunc(privateKey,Tx);
        }
        else
        {
            return this.ethSign(privateKey);
        }
    }
    signFromKeystore(password)
    {
        let privateKey = this.Account.getPrivateKey(password);
        if(privateKey)
        {
            return this.sign(privateKey);
        }
        else
        {
            return null;
        }
    }
    ethSign(privateKey)
    {
        delete  this.trans.Txtype;
        return this.signFunc(privateKey,EthTx);
    }
    send(web3,password,callback){
        console.log(this.trans);
        web3.personal.sendTransaction(this.trans,password,callback)
    }
    sendRaw(web3,rawTx,callback){
        web3.personal.sendRawTransaction(rawTx,callback);
    }
};
//normal transaction
class NormalSend extends IRawTransaction
{
    constructor(from,to,amount,gas,gasPrice,nonce)
    {
        super(from,to,gas,gasPrice,nonce);
        this.trans.setValue(amount);
    }
};
class TokenSend extends IRawTransaction
{
    constructor(from,to,gas,gasPrice,nonce)
    {
        super(from,to,gas,gasPrice,nonce);
        this.trans.setValue(0);
    }
};
exports.NormalSend = NormalSend;
exports.TokenSend = TokenSend;
