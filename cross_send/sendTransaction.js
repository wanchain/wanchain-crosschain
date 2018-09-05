"use strict";


let dbname = 'crossTransDb';
let wanHashXSend = require('../wanchaintrans/index.js').wanHashXSend;
let ethHashXSend = require('../wanchaintrans/index.js').ethHashXSend;
let NormalSend = require('../wanchaintrans/index.js').NormalSend;
let TokenSend = require("../wanchaintrans/interface/transaction.js").TokenSend;
const cm = require('../comm.js');
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
let logDebug;
function hexTrip0x(hexs){
	if(0 == hexs.indexOf('0x')){
		return hexs.slice(2);
	}
	return hexs;
}

module.exports = class sendTransaction{
    constructor(sendServer){
        this.sendServer = sendServer;
        logDebug = global.getLogger('sendTransaction');
        let wanSc = web3.eth.contract(cm.config.HTLCWBTCInstAbi);
        this.wanIns = wanSc.at(cm.config.wanchainHtlcAddr);
    }
    // the min decimal,wei.
    createTransaction(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce){
        let WanKeyStoreDir = global.WanKeyStoreDir;
        let EthKeyStoreDir = global.EthKeyStoreDir;
        if(this.sendServer.chainType == 'WAN'){
            this.trans = new wanHashXSend(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce);
            this.trans.setAccount(WanKeyStoreDir);
        }
        else
        {
            this.trans = new ethHashXSend(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce);
            this.trans.setAccount(EthKeyStoreDir);
        }
    }

    createDepositNotice(from, storeman,userH160,hashx,txhash, lockedTimestamp, gas, pasPrice){
        let payload = this.wanIns.btc2wbtcLockNotice.getData(storeman,userH160,hashx,txhash, lockedTimestamp);
        // TokenSend(from, to, gas, gasprice nonce);
        this.trans = new TokenSend(from, config.wanchainHtlcAddr, gas, pasPrice);
        this.trans.setAccount(WanKeyStoreDir);
        this.trans.trans.data = payload;
        // console.log(this.trans);
    }
    sendNoticeTrans(password,callback){
        let self = this;
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertNoticeData,callback);
        })
    }
    createNormalTransaction(from,to,amount,gas,gasPrice,nonce){
        let WanKeyStoreDir = global.WanKeyStoreDir;
        let EthKeyStoreDir = global.EthKeyStoreDir;
        this.trans = new NormalSend(from,to,amount,gas,gasPrice,nonce);
        this.trans.ChainType = this.sendServer.chainType
        if(this.sendServer.chainType == 'WAN'){
            this.trans.setAccount(WanKeyStoreDir);
        }
        else
        {
            this.trans.setAccount(EthKeyStoreDir);
        }
    }

    createRefundFromLockTransaction(lockTxHash,tokenAddress,amountWan,storeman,wanAddress,gas,gasPrice,crossType,nonce){
        let self = this;
        let collection = global.getCollection(dbname,'crossTransaction');
        let lockTrans = collection.findOne({lockTxHash : lockTxHash});
        if(lockTrans) {
            self.createTransaction(lockTrans.crossAdress, tokenAddress, amountWan, storeman,
                wanAddress, gas, gasPrice, crossType, nonce);
            self.trans.setKey(lockTrans.x);
        }
    }
    createRevokeFromLockTransaction(lockTxHash,tokenAddress,amountWan,storeman,wanAddress,gas,gasPrice,crossType,nonce){
        let self = this;
        let collection = global.getCollection(dbname,'crossTransaction');
        let lockTrans = collection.findOne({lockTxHash : lockTxHash});
        if(lockTrans) {
            self.createTransaction(lockTrans.from, tokenAddress, amountWan, storeman,
                wanAddress, gas, gasPrice, crossType, nonce);
            self.trans.setKey(lockTrans.x);
        }
    }

    sendLockTrans(password,callback){
        let self = this;
        this.trans.setLockData();
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertLockData,callback);
        })
    }
    sendRefundTrans(password,callback){
        let self = this;
        this.trans.setRefundData();
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertRefundData,callback);
        })
    }
    sendRevokeTrans(password,callback){
        let self = this;
        this.trans.setRevokeData();
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertRevokeData,callback);
        })
    }
    sendNormalTrans(password,callback){
        let self = this;
        self.getNonce(function () {
            self.sendTrans(self.trans,password,self.insertNormalData,callback);
        })
    }
    getNonce(callback){
        let self = this;
        if(self.trans.trans.nonce || self.sendServer.web3){
            callback();
            return;
        }

        this.sendServer.sendMessage('getNonce',this.trans.trans.from,function (err,result) {
            if(!err){
                self.trans.trans.nonce = result;
            }
            callback();
        });
    }
    sendTrans(trans,password,insert,callback){
        let chainType = this.sendServer.chainType;
        this.sendServer.send(trans,password,function (err,result) {
            logDebug.debug(err,result);
            if(!err){
                logDebug.debug("sendRawTransaction: ",result);
                if(insert){
                    insert(trans,result,chainType);
                }
                callback(err,result);
            }
            else{
                callback(err,result);
            }
        })
    }
    insertLockData(trans,result,chainType){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            let cur = Date.now();
            collection.insert(
                {
                    HashX : hexTrip0x(trans.Contract.hashKey),
                    from : trans.trans.from,
                    to : trans.trans.to,
                    storeman:trans.Contract.storeman,
                    crossAdress : trans.Contract.crossAddress,
                    value : trans.amount,
                    txValue: trans.trans.value,
                    x : trans.Contract.key,
                    time : cur.toString(),
                    HTLCtime: (3000000+2*1000*Number(global.lockedTime)+cur).toString(),
                    chain : chainType,
                    status : 'sentHashPending',
                    lockConfirmed:0,
                    refundConfirmed:0,
                    revokeConfirmed:0,
                    lockTxHash: hexTrip0x(result),
                    refundTxHash : '',
                    revokeTxHash : '',

                });
        })

    }
    insertNormalData(trans,result,chainType){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            collection.insert(
                {
                    from : trans.trans.from,
                    to : trans.trans.to,
                    value : web3.fromWei(trans.trans.value).toString(10),
                    time : Date.now().toString(),
                    txhash: result,
                    chain : chainType,

                });
        });
    }

    insertRefundData(trans,result){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            let value = collection.findOne({HashX:hexTrip0x(trans.Contract.hashKey)});
            if(value){
                value.refundTxHash = hexTrip0x(result);
                collection.update(value);
            }
        });
    }
    insertRevokeData(trans,result){
        global.getCollectionCb(dbname,'crossTransaction', function(collection){
            let value = collection.findOne({HashX:hexTrip0x(trans.Contract.hashKey)});
            if(value){
                value.revokeTxHash = hexTrip0x(result);
                collection.update(value);
            }
        });
    }
}
