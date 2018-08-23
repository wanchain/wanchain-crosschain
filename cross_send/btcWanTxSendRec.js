"use strict";


let dbname = 'crossTransDb';
let wanHashXSend = require('../wanchaintrans/index.js').wanHashXSend;
let btcHashXSend = require('../wanchaintrans/index.js').btcHashXSend;

let NormalSend = require('../wanchaintrans/index.js').NormalSend;
let TokenSend = require("../wanchaintrans/interface/transaction.js").TokenSend;
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
let logDebug;

module.exports = class btcWanTxSendRec{

    constructor(sendServer){
        this.sendServer = sendServer;
        logDebug = global.getLogger('sendTransaction');
        let wanSc = web3.eth.contract(global.config.HTLCWBTCInstAbi);
        this.wanIns = wanSc.at(global.config.wanchainHtlcAddr);
    }

    // the min decimal,wei.
    createWanTransaction(from,tokenAddress,amount,storeman,wanAddress,gas,gasPrice,crossType,nonce) {
        let WanKeyStoreDir = global.WanKeyStoreDir;
        this.trans = new wanHashXSend(from, tokenAddress, amount, storeman, wanAddress, gas, gasPrice, crossType, nonce);
        this.trans.setAccount(WanKeyStoreDir);

    }

    createBtcTransaction(senderH160Addr,pshAddr,value,recieverH160Addr,senderWanAddr,feeRate,fee,crossType,redeemLockTimeStamp){
        this.btcTrans = new btcHashXSend(senderH160Addr,pshAddr,value,recieverH160Addr,senderWanAddr,feeRate,fee,crossType,redeemLockTimeStamp);
    }


/*
    createDepositNotice(storeman,userWanAddr,hashx,txhash, lockedTimestamp, gas, pasPrice){
        //function btc2wbtcLockNotice(address storeman, address userWanAddr, bytes32 xHash, bytes32 txHash, uint lockedTimestamp)
        let payload = this.wanIns.btc2wbtcLockNotice.getData(storeman,userWanAddr,hashx,txhash, lockedTimestamp);
        // TokenSend(from, to, gas, gasprice nonce);
        this.trans = new TokenSend(userWanAddr, config.wanchainHtlcAddr, gas, pasPrice);
        this.trans.setAccount(WanKeyStoreDir);
        this.trans.trans.data = payload;
        console.log(this.trans);
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
*/

    insertLockData(trans,crossType){
        if(crossType == 'WAN2BTC') {
            global.getCollectionCb(dbname, 'btcCrossTransaction', function (collection) {
                trans = trans.trans
                let cur = Date.now();
                collection.insert(
                    {
                        HashX: trans.Contract.hashKey,
                        from: trans.trans.from,
                        to: trans.trans.to,
                        storeman: trans.Contract.storeman,
                        crossAdress: trans.Contract.crossAddress,
                        value: trans.amount,
                        txValue: trans.trans.value,
                        x: trans.Contract.key,
                        time: cur.toString(),
                        HTLCtime: (100000 + 2 * 1000 * Number(global.lockedTime) + cur).toString(),
                        chain: chainType,
                        status: 'sentHashPending',
                        lockConfirmed: 0,
                        refundConfirmed: 0,
                        revokeConfirmed: 0,
                        lockTxHash: result,
                        refundTxHash: '',
                        revokeTxHash: '',

                    });
            })

            return null
        } else if (crossType == 'BTC2WAN') {
            trans = trans.btcTrans;
            global.getCollectionCb(dbname, 'btcCrossTransaction', function (collection) {
                let cur = Date.now();
                collection.insert(
                    {
                        HashX: trans.hashKey,
                        from: trans.from,
                        to: trans.to,
                        storeman: trans.storeman,
                        crossAdress: trans.crossAddress,
                        value: trans.amount,
                        txValue: trans.value,
                        x: trans.key,
                        time: cur.toString(),
                        HTLCtime: (100000 + 2 * 1000 * Number(global.lockedTime) + cur).toString(),
                        chain: "BTC",
                        status: 'sentHashPending',
                        lockConfirmed: 0,
                        refundConfirmed: 0,
                        revokeConfirmed: 0,
                        lockTxHash: result,
                        refundTxHash: '',
                        revokeTxHash: '',

                    });
            });
            return null
        } else {
            return new Error('Not supported cross chain type');
        }

    }

    insertNormalData(trans,result){
        global.getCollectionCb(dbname,'btcCrossTransaction', function(collection){
            if(trans.crossType == 'WAN2BTC') {
                collection.insert(
                    {
                        from: trans.trans.from,
                        to: trans.trans.to,
                        value: web3.fromWei(trans.trans.value).toString(10),
                        time: Date.now().toString(),
                        txhash: result,
                        chain: "WAN",

                    });

                return null

            } else if (trans.crossType == 'BTC2WAN') {
                collection.insert(
                    {
                        from: trans.from,
                        to: trans.to,
                        value: trans.value.toString(10),
                        time: Date.now().toString(),
                        txhash: result,
                        chain: "BTC",

                    });
                return null
            } else {
                return  new Error('Not supported cross chain type');
            }
        });
    }

    insertRefundData(trans,result){

        global.getCollectionCb(dbname,'btcCrossTransaction', function(collection){
            let value = null;

            if(trans.crossType == 'WAN2BTC') {
                value = collection.findOne({HashX: trans.Contract.hashKey});
            } else if (trans.crossType == 'BTC2WAN') {
                value = collection.findOne({HashX: trans.hashKey});
            } else {
                return  new Error('Not supported cross chain type');
            }

            if(value != null){
                value.refundTxHash = result;
                collection.update(value);
            } else {
                return  new Error('Not find updating item');
            }
        });

    }

    insertRevokeData(trans,result){

        global.getCollectionCb(dbname,'btcCrossTransaction', function(collection){

            let value = null;

            if(trans.crossType == 'WAN2BTC') {
                value = collection.findOne({HashX: trans.Contract.hashKey});
            } else if (trans.crossType == 'BTC2WAN') {
                value = collection.findOne({HashX: trans.hashKey});
            } else {
                return  new Error('Not supported cross chain type');
            }

            if(value != null){
                value.revokeTxHash = result;
                collection.update(value);
            } else {
                return  new Error('Not find updating item');
            }

        });
    }

}