"use strict";

const crypto = require('crypto');
const secp256k1 = require('secp256k1');
let IContract = require("../contract/IContract.js");
const createKeccakHash = require('keccak');
//let util = require('utility');


let ETH2WETHfunc = ['','btc2wbtcRefund','','BTC2WBTCLock'];
let WETH2ETHfunc = ['wbtc2btcLock','','wbtc2btcRevoke','WBTC2BTCLock'];
let logDebug;
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
    getHashKey(key){
        //return BigNumber.random().toString(16);

        let kBuf = new Buffer(key.slice(2), 'hex');
//        let hashKey = '0x' + util.sha256(kBuf);
        let h = createKeccakHash('keccak256');
        h.update(kBuf);
        let hashKey = '0x' + h.digest('hex');
        logDebug.debug('input key:', key);
        logDebug.debug('input hash key:', hashKey);
        return hashKey;

    }
    generatePrivateKey(){
        let randomBuf;
        do{
            randomBuf = crypto.randomBytes(32);
        }while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    }
    getLockData(Amount)
    {
        this.Amount = Amount;
        let funcInterface = this.getFuncInterface(this.contractFunc[0]);
        if(funcInterface)
        {
            logDebug.debug(this.hashKey,this.storeman,this.crossAddress);
            if(this.Amount){
                return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress,this.Amount.getWei());
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
