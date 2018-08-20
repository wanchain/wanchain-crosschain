"use strict";

const crypto = require('crypto');
const secp256k1 = require('secp256k1');
let IContract = require("../contract/IContract.js");
const createKeccakHash = require('keccak');
//let util = require('utility');
const bitcoin  = require('bitcoinjs-lib');


let ETH2WETHfunc = ['','btc2wbtcRefund','','BTC2WBTCLock'];
let WETH2ETHfunc = ['wbtc2btcLock','','wbtc2btcRevoke','WBTC2BTCLock'];
let logDebug;
function hexTrip0x(hexs){
    if(0 == hexs.indexOf('0x')){
        return hexs.slice(2);
    }
    return hexs;
}
module.exports = class hashContract extends IContract
{
    constructor(tokenAddress,storeman,crossAddress,crossType,ChainType)
    {
        let abi =  global.config.HTLCWBTCInstAbi;
        if(crossType == 'ETH2WETH')
            super(abi,ETH2WETHfunc,tokenAddress);
        else
            super(abi,WETH2ETHfunc,tokenAddress);
        logDebug = global.getLogger('wanchainTrans');
        this.storeman = storeman;
        this.crossAddress = crossAddress;
        this.key = this.generatePrivateKey();
        this.hashKey = this.getHashKey(this.key);
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
