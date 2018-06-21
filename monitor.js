'use strict'


const pu = require('promisefy-util');
let config;
let crosschain = require('./dbDefine/crossTransDefine.js');
const wanUtil = require("wanchain-util");

let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
let databaseGroup = require('./wanchaindb/index.js').databaseGroup;
let backendConfig = {};
let logger;
let handlingList = [];

const MonitorRecord = {
    CreaterSender(ChainType) {
            return new sendFromSocket(new socketServer(config.socketUrl,messageFactory),ChainType);
    },

    async init(cfg, ethSender, wanSender){
        config = cfg? cfg:require('./config.js');
        logger = config.logDebug.getLogger("monitorRecord");
        backendConfig.ethGroupAddr = config.originalChainHtlc;
        backendConfig.wethGroupAddr = config.wanchainHtlcAddr;
        this.ethSender = ethSender;
        this.wanSender = wanSender;
    },
    getDbCollection(){
        return databaseGroup.getCollection(config.crossDbname,config.crossCollection);
    },

    getSenderbyChain(chainType){
        return chainType == "ETH"? this.ethSender : this.wanSender;
    },
    async createrSender(ChainType,local=false){
        if(config.hasLocalNode && ChainType=="WAN" && local){
            return this.createrWeb3Sender(config.rpcIpcPath);
        }else{
            return await this.createrSocketSender(ChainType);
        }

    },
    async createrSocketSender(ChainType){
        let sender =  this.CreaterSender(ChainType);
        await pu.promiseEvent(this.CreaterSender, [ChainType], sender.socket.connection, "open");
        return sender;
    },
    getTxReceipt(sender,txhash){
        let bs = pu.promisefy(sender.sendMessage, ['getTransactionReceipt',txhash], sender);
        return bs;
    },

    getTxHistory(option) {
        let collection = this.getDbCollection();
        let Data = collection.find(option);
        let his = [];
        for(var i=0;i<Data.length;++i){
            let Item = Data[i];
            his.push(Item);
        }
        return his;
    },
    getDepositOrigenLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositOriginLockEvent).toString('hex'), null, null, hashX];
        let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return b;
    },
    getWithdrawOrigenLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawOriginLockEvent).toString('hex'), null, null, hashX];
        let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return b;
    },
    getWithdrawCrossLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawCrossLockEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositCrossLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositCrossLockEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getDepositOriginRefundEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositOriginRefundEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getWithdrawOriginRefundEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawOriginRefundEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositRevokeEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositOriginRevokeEvent).toString('hex'), null,  hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getWithdrawRevokeEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawOriginRevokeEvent).toString('hex'), null,  hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getDepositHTLCLeftLockedTime(sender, hashX){
        let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.originalChainHtlc, 'getHTLCLeftLockedTime',[hashX],config.HTLCETHInstAbi], sender);
        return p;
    },
    getWithdrawHTLCLeftLockedTime(sender, hashX){
        let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.wanchainHtlcAddr, 'getHTLCLeftLockedTime',[hashX],config.HTLCWETHInstAbi], sender);
        return p;
    },
    monitorTxConfirm(sender, txhash, waitBlocks) {
        let p = pu.promisefy(sender.sendMessage, ['getTransactionConfirm', txhash, waitBlocks], sender);
        return p;
    },

    monitorTask(){
        let collection = this.getDbCollection();
        let history = collection.find({ 'status' : { '$nin' : ['refundFinished','revokeFinished'] } });
        //logger.debug(history);
        let self = this;
        logger.debug('handlingList length is ', handlingList.length);
        for(let i=0; i<history.length; i++){
            let record = history[i];
            if( handlingList.indexOf(record.HashX) != -1) {
                continue;
            }
            handlingList.push(record.HashX);
            self.monitorRecord(record);
        }
    },
    async checkOriginLockOnline(record){
        try {
            let sender;
            let receipt;
            if(record.chain == "ETH"){
                sender = this.getSenderbyChain("ETH");
                receipt = await this.getDepositOrigenLockEvent(sender,record.HashX);
            }else {
                sender = this.getSenderbyChain("WAN");
                receipt = await this.getWithdrawOrigenLockEvent(sender,record.HashX);
            }

            if(receipt && receipt.length>0){
                record.status = 'sentHashConfirming';
                this.updateRecord(record );
            }
        }catch(err){
            logger.error("checkOriginLockOnline:", err);
        }
    },
    async checkXOnline(record){
        try {
            let sender;
            let receipt;
            if(record.chain == "ETH"){
                sender = this.getSenderbyChain("WAN");
                receipt = await this.getDepositOriginRefundEvent(sender,record.HashX);
            } else {
                sender = this.getSenderbyChain("ETH");
                receipt = await this.getWithdrawOriginRefundEvent(sender,record.HashX);
            }

            if(receipt && receipt.length>0){
                record.status = 'sentXConfirming';
                this.updateRecord(record );
            }
        }catch(err){
            console.log("checkTxOnline:", err);
        }
    },
    async checkRevokeOnline(chain, record){
        try {
            let sender;
            let receipt;
            if(record.chain == "ETH"){
                sender = this.getSenderbyChain("ETH");
                receipt = await this.getDepositRevokeEvent(sender,record.HashX);
            }else {
                sender = this.getSenderbyChain("WAN");
                receipt = await this.getWithdrawRevokeEvent(sender,record.HashX);
            }

            if(receipt && receipt.length>0){
                record.status = 'sentRevokeConfirming';
                this.updateRecord(record );
            }
        }catch(err){
            console.log("checkRevokeOnline:", err);
        }
    },
    async checkHashConfirm(record, waitBlocks){
        try {
            let sender = this.getSenderbyChain(record.chain);
            let receipt = await this.monitorTxConfirm(sender, record.lockTxHash, waitBlocks);

            if(receipt){
                record.lockConfirmed += 1;
                if(record.lockConfirmed >= config.confirmBlocks){
                    record.status = 'waitingCross';
                }
                this.updateRecord(record);
            }
        }catch(err){
            console.log("checkHashConfirm:", err);
        }
    },
    async checkXConfirm(record, waitBlocks){
        try {
            let chain = record.chain=='ETH'?"WAN":"ETH";
            let sender = this.getSenderbyChain(chain);
            let receipt = await this.monitorTxConfirm(sender, record.refundTxHash, waitBlocks);

            if(receipt){
                record.refundConfirmed += 1;
                if(record.refundConfirmed >= config.confirmBlocks){
                    record.status = 'refundFinished';
                }
                this.updateRecord(record);
            }
        }catch(err){
            console.log("checkXConfirm:", err);
        }
    },
    async checkRevokeConfirm(chain, record, waitBlocks){
        try {
            let sender = this.getSenderbyChain(chain);
            let receipt = await this.monitorTxConfirm(sender, record.revokeTxHash, waitBlocks);

            if(receipt){
                record.revokeConfirmed += 1;
                if(record.revokeConfirmed >= config.confirmBlocks){
                    record.status = 'revokeFinished';
                }
                this.updateRecord(record);
            }
        }catch(err){
            console.log("checkRevokeConfirm:", err);
        }
    },
    async checkCrossHashConfirm(record, waitBlocks){
        try {
            let chain = record.chain=='ETH'?"WAN":"ETH";
            let sender = this.getSenderbyChain(chain);
            let receipt = await this.monitorTxConfirm(sender, record.crossLockHash, waitBlocks);

            if(receipt){
                if(!record.crossConfirmed) record.crossConfirmed = 0;
                record.crossConfirmed += 1;
                if(record.crossConfirmed >= config.confirmBlocks){
                    record.status = 'waitingX';
                    this.updateRecord(record);
                }
            }
        }catch(err){
            console.log("checkCrossHashConfirm:", err);
        }
    },

    async checkHashTimeout( record){
        if(record.status == "waitingRevoke,"
            || record.status =="sentRevokePending"
            || record.status =="sentRevokeConfirming"){
            return true;
        }
        try {
            let HTLCtime = Number(record.HTLCtime);
            if(HTLCtime <= Date.now()){
                record.status = 'waitingRevoke';
                this.updateRecord(record);
                return true;
            }
        }catch(err){
            console.log("checkHashTimeout:", err);
        }
        return false;
    },
    async checkCrossHashOnline(record){
        try {
            let receipt;
            let sender
            if(record.chain=="ETH"){
                sender = this.getSenderbyChain("WAN");
                receipt = await this.getDepositCrossLockEvent(sender,record.HashX);
            }else {
                sender = this.getSenderbyChain("ETH");
                receipt = await this.getWithdrawCrossLockEvent(sender,record.HashX);
            }

            if(receipt && receipt.length>0){
                record.crossConfirmed = 1;
                record.crossLockHash = receipt[0].transactionHash;
                record.status = 'waitingCrossConfirming';
                this.updateRecord(record);
                // console.log("######waitingCross done ");
            }
        }catch(err){
            console.log("checkCrossHashOnline:", err);
        }
    },
    updateRecord(record){
        let collection = this.getDbCollection();
        collection.update(record);
    },



    async monitorRecord(record){
        let waitBlock = config.confirmBlocks;
        let chain = record.chain;
        if(this.checkHashTimeout(record) == true){
            console.log("tx timeout: ", record);
        }
        //logger.debug("record status is ", record.status);
        switch(record.status) {
            case 'sentHashPending':
                await this.checkOriginLockOnline(record);
                break;
            case 'sentHashConfirming':
                waitBlock = record.lockConfirmed < config.confirmBlocks ? record.lockConfirmed: config.confirmBlocks;
                await this.checkHashConfirm(record, waitBlock);
                break;
            case 'waitingCross':
                await this.checkCrossHashOnline(record);
                break;
            case 'waitingCrossConfirming':
                if(record.refundTxHash){
                    record.status = 'sentXPending';
                    this.updateRecord(record);
                    break;
                }
                await this.checkCrossHashConfirm( record, config.confirmBlocks);
                break;
            case 'waitingX':
                if(record.refundTxHash){
                    record.status = 'sentXPending';
                    this.updateRecord(record);
                }
                break;
            case 'waitingRevoke':
                if(record.revokeTxHash){
                    record.status = 'sentRevokePending';
                    this.updateRecord(record);
                }
                break;
            case 'sentRevokePending':
                await this.checkRevokeOnline(record.chain, record);
                break;
            case 'sentRevokeConfirming':
                waitBlock = record.lockConfirmed < config.confirmBlocks ? record.lockConfirmed: config.confirmBlocks;
                await this.checkRevokeConfirm(record.chain, record, waitBlock);
                break;

            case 'sentXPending':
                await this.checkXOnline(record);
                break;
            case 'sentXConfirming':
                chain = record.chain=='ETH'?"WAN":"ETH";
                waitBlock = record.refundConfirmed < config.confirmBlocks ? record.refundConfirmed: config.confirmBlocks;
                await this.checkXConfirm(record, waitBlock);
                break;

            case 'refundFinished':
            case 'revokeFinished':
                break;
            default:
                break;
        }
        let pos = handlingList.indexOf(record.HashX);
        if(pos != -1){
            handlingList.splice(pos,1);
        }

    },
}


exports.MonitorRecord = MonitorRecord;
