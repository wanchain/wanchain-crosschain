"use strict";

const crypto = require('crypto');
const secp256k1 = require('secp256k1');
let IContract = require("../contract/IContract.js");
const createKeccakHash = require('keccak');
//let util = require('utility');
const bitcoin  = require('bitcoinjs-lib');
const cm = require('../../comm.js');

let BTC2WBTCfunc = ['','btc2wbtcRefund','','BTC2WBTCLock'];
let WBTC2BTCfunc = ['wbtc2btcLock','','wbtc2btcRevoke','WBTC2BTCLock'];
let logDebug;
function hexTrip0x(hexs){
    if(0 == hexs.indexOf('0x')){
        return hexs.slice(2);
    }
    return hexs;
}
module.exports = class hashContract extends IContract
{
    constructor(tokenAddress,storeman,crossAddress,crossType)
    {
        let abi =  cm.config.HTLCWBTCInstAbi;
        if(crossType == 'BTC2WBTC')
            super(abi,BTC2WBTCfunc,tokenAddress);
        else
            super(abi,WBTC2BTCfunc,tokenAddress);
        logDebug = cm.getLogger('wanchainTrans');
        this.storeman = storeman;
        this.crossAddress = crossAddress;
        this.key = this.generatePrivateKey();
        this.hashKey = this.getHashKey(this.key);
    }
    setKey(key){
        this.key = key;
        this.hashKey = this.getHashKey(this.key);
    }
	setHashkey(hashKey){
		this.hashKey = hashKey;
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
    getLockData(amount)
    {
        this.amount = amount;
        let funcInterface = this.getFuncInterface(this.contractFunc[0]);
        if(funcInterface)
        {
            logDebug.debug(this.hashKey,this.storeman,this.crossAddress);
            if(this.amount){
                return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress,this.amount);
            }
            else
            {
                return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress);
            }
        }
    }
    getRefundData(){
        let funcInterface = this.getFuncInterface(this.contractFunc[1]);
        if(funcInterface)
        {
            logDebug.debug('unlock data Key: ', this.key);
            return funcInterface.getData(this.key);
        }
    }
    getRevokeData(){
        let funcInterface = this.getFuncInterface(this.contractFunc[2]);
        if(funcInterface)
        {
            return funcInterface.getData(this.hashKey);
        }
    }
    getLockEvent(){
        return [this.getEventCode(this.contractFunc[3]),null,null,this.hashKey];
    }
}
