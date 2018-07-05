'use strict'


const pu = require('promisefy-util');
let config;
const be = require('./ccUtil.js').Backend;

//let databaseGroup = require('./wanchaindb/index.js').databaseGroup;
let backendConfig = {};
let logger;
let handlingList = [];


const MonitorRecord = {
    async init(cfg, ethSender, wanSender){
        config = cfg? cfg:require('./config.js');
        logger = config.logDebug.getLogger("monitorRecord");
        backendConfig.ethGroupAddr = config.originalChainHtlc;
        backendConfig.wethGroupAddr = config.wanchainHtlcAddr;
        this.ethSender = ethSender;
        this.wanSender = wanSender;
    },

    getSenderbyChain(chainType){
        return chainType == "ETH"? this.ethSender : this.wanSender;
    },

    getTxReceipt(sender,txhash){
        let bs = pu.promisefy(sender.sendMessage, ['getTransactionReceipt',txhash], sender);
        return bs;
    },

    monitorTxConfirm(sender, txhash, waitBlocks) {
        let p = pu.promisefy(sender.sendMessage, ['getTransactionConfirm', txhash, waitBlocks], sender);
        return p;
    },

    monitorTask(){
        let collection = be.getCrossdbCollection();
        let history = collection.find({ 'status' : { '$nin' : ['refundFinished','revokeFinished','sentHashFailed'] } });
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
                receipt = await be.getDepositOrigenLockEvent(sender,record.HashX);
            }else {
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getWithdrawOrigenLockEvent(sender,record.HashX);
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
                receipt = await be.getDepositOriginRefundEvent(sender,record.HashX);
            } else {
                sender = this.getSenderbyChain("ETH");
                receipt = await be.getWithdrawOriginRefundEvent(sender,record.HashX);
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
                receipt = await be.getDepositRevokeEvent(sender,record.HashX);
            }else {
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getWithdrawRevokeEvent(sender,record.HashX);
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
    async checkHashReceiptOnline(record){
        try {
            let sender = this.getSenderbyChain(record.chain);
            let receipt = await this.monitorTxConfirm(sender, record.lockTxHash, 0);

            if(receipt){
                if(receipt.status === '0x1'){
                    record.status = 'sentHashConfirming';
                }else{
                    record.status = 'sentHashFailed';
                }
                this.updateRecord(record);
            }
        }catch(err){
            //console.log("checkHashReceiptOnline:", err);
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
        if(record.status === "sentHashFailed") {
            return false;
        }
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
                receipt = await be.getDepositCrossLockEvent(sender,record.HashX);
            }else {
                sender = this.getSenderbyChain("ETH");
                receipt = await be.getWithdrawCrossLockEvent(sender,record.HashX);
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
        let collection = be.getCrossdbCollection();
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
                //await this.checkOriginLockOnline(record);
                await this.checkHashReceiptOnline(record);
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
