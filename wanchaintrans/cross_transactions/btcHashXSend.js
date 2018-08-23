"use strict";

let hashContract = require('../cross_contract/hashContract.js');
let hashXSend = require('./hashXSend.js');

module.exports = class btcHashXSend extends hashContract
{

    constructor(senderH160Addr,pshAddr,value,recieverH160Addr,senderWanAddr,feeRate,fee,crossType,redeemLockTimeStamp)
    {
        this.from = senderH160Addr;
        this.to = pshAddr;
        this.value = value;
        this.amount = value;
        this.storeman = recieverH160Addr;
        this.crossAddress = senderWanAddr;
        this.key = this.generatePrivateKey();
        this.hashKey = this.getHashKey(this.key);
        this.feeRate = feeRate;
        this.fee = fee;
        this.crossType = crossType;
        this.redeemLockTimeStamp = redeemLockTimeStamp;

    }

    setKey(key){
        this.key = key;
        this.hashKey = this.getHashKey(this.key);
    }

    getHashKey(key1){
        //return BigNumber.random().toString(16);
        let key = hexTrip0x(key1);
        let hashKey = '0x'+bitcoin.crypto.sha256(Buffer.from(key, 'hex')).toString('hex');
        return hashKey;

    }

    generatePrivateKey(){
        let randomBuf;
        do{
            randomBuf = crypto.randomBytes(32);
        }while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    }

    setTokenAddress(tokenAddress){

    }

    setValue(v){

    }

    setLockData(){

    }

    setRefundData(){

    }

    setRevokeData(){

    }

}