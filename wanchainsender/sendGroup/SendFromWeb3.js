'use strict';

const Web3 = require("web3");
const net = require("net");
module.exports = class SendFromWeb3{
    constructor(web3url,onLine){
        if(web3url){
            let web3 = new Web3(new Web3.providers.IpcProvider(web3url, net));
            onLine = true;
            this.chainType = "WAN";
            this.web3 = web3;
            this.onLine = onLine;
        }
    }
    send(trans,password,callback){
        if(this.onLine){
            this.sendOnChain(trans,password,callback);
        }
        else{
            this.sendRawTrans(trans,password,callback);
        }
    }
    sendOnChain(trans,password,callback){
        trans.send(this.web3,password,callback)
    }
    sendRawTrans(trans,password,callback){
        let rawTx = trans.signFromKeystore(password);
        trans.sendRaw(rawTx,callback);
    }
    getBalance(address,callBack){
        this.web3.eth.getBalance(address,callBack);
    }
}