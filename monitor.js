'use strict'

const pu = require('promisefy-util');
let config;
const be = require('./ccUtil.js').Backend;
const cm = require('./comm.js');

let backendConfig = {};
let logger;
let handlingList = {};


const MonitorRecord = {
    async init(cfg, ethSender, wanSender,btcSender){
        config = cfg? cfg:require('./config.js');
        logger = config.getLogger("monitorRecord");
        backendConfig.ethGroupAddr = config.originalChainHtlc;
        backendConfig.wethGroupAddr = config.wanchainHtlcAddr;
        this.ethSender = ethSender;
        this.wanSender = wanSender;
        this.btcSender = btcSender;
        handlingList = {};
    },

    getSenderbyChain(chainType){
        return chainType == "BTC"? this.btcSender : this.wanSender;
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
        logger.debug('handlingList length is ', Object.keys(handlingList).length);
        for(let i=0; i<history.length; i++){
            let record = history[i];
            let cur = Date.now();
            if( handlingList[record.HashX]) {
                if(handlingList[record.HashX]+300000 < cur){
                    delete handlingList[record.HashX];
                }else{
                    continue;
                }
            }
            handlingList[record.HashX] = cur;
            try{
                self.monitorRecord(record);
            }catch(error){
                logger.error("monitorRecord error:", error);
            }
        }
    },
    async checkOriginLockOnline(record){
        try {
            let sender;
            let receipt;
            if(record.chain == "BTC"){
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getDepositWanNoticeEvent(sender,'0x'+record.HashX);
            }else {
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getWithdrawOrigenLockEvent(sender,'0x'+record.HashX);
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
            if(record.chain == "BTC"){
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getDepositRedeemEvent(sender,'0x'+record.HashX);
                if(receipt && receipt.length>0){
                    record.status = 'sentXConfirming';
                    this.updateRecord(record );
                }
            } else {
                let redeemTxHash = record.btcRefundTxHash;
                let btcTx = await be.getBtcTransaction(be.btcSender, redeemTxHash);
                logger.debug("checkXOnline: ", btcTx);
                if(btcTx && btcTx.confirmations && btcTx.confirmations>0){
                    record.status = 'sentXConfirming';
                    this.updateRecord(record );
                }
            }
        }catch(err){
            logger.error("checkTxOnline:", err);
        }
    },
    async checkRevokeOnline(chain, record){
        try {
            if(record.chain == "BTC"){
                let btcTx = await be.getBtcTransaction(be.btcSender, record.btcRevokeTxHash);
                logger.debug("checkRevokeOnline: ", btcTx);
                if(btcTx && btcTx.confirmations && btcTx.confirmations>=1){
                    record.status = 'sentRevokeConfirming';
                    this.updateRecord(record );
                }
            }else {
                let sender = this.getSenderbyChain("WAN");
                let receipt = await be.getWithdrawRevokeEvent(sender,'0x'+record.HashX);
                if(receipt && receipt.length>0){
                    record.status = 'sentRevokeConfirming';
                    this.updateRecord(record );
                }
            }
        }catch(err){
            //console.log("checkRevokeOnline:", err);
        }
    },
    async checkHashConfirm(record, waitBlocks){
        try {
            let sender = this.getSenderbyChain("WAN");
	        let txhash;
	        if(record.chain == 'BTC')
	        {
		        txhash = '0x'+record.btcNoticeTxhash;
	        } else {
		        txhash = '0x'+record.lockTxHash;
	        }
            let receipt = await this.monitorTxConfirm(sender, txhash, waitBlocks);

            if(receipt){
                record.lockConfirmed += 1;
                if(record.lockConfirmed >= config.confirmBlocks){
                    record.status = 'waitingCross';
                }
                this.updateRecord(record);
            }
        }catch(err){
            //console.log("checkHashConfirm:", err);
        }
    },
    async checkHashReceiptOnline(record){
        try {
            let sender = this.getSenderbyChain('WAN');
            let txhash;
            if(record.chain == 'BTC')
            {
                txhash = '0x'+record.btcNoticeTxhash;
            } else {
	            txhash = '0x'+record.lockTxHash;
            }
            let receipt = await this.monitorTxConfirm(sender, txhash, 0);

            if(receipt){
                if(receipt.status === '0x1'){
                    record.status = 'sentHashConfirming';
                    // update the time to block time.
                    let block = await be.getBlockByNumber(sender, receipt.blockNumber)
                    let newtime = Number(block.timestamp)*1000;
                    record.time = newtime.toString();
                    record.suspendTime = (1000*Number(cm.lockedTime)+newtime).toString();
                    record.HTLCtime = (6*cm.config.blockInterval+2*1000*Number(cm.lockedTime)+newtime).toString();
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
            if(record.chain == "BTC"){
                let sender = this.getSenderbyChain('WAN');
                let receipt = await this.monitorTxConfirm(sender, '0x'+record.refundTxHash, waitBlocks);
                if(receipt){
                    record.refundConfirmed += 1;
                    if(record.refundConfirmed >= config.confirmBlocks){
                        record.status = 'refundFinished';
                    }
                    this.updateRecord(record);
                }

            }else{
                let redeemTxHash = record.btcRefundTxHash;
                let btcTx = await be.getBtcTransaction(be.btcSender, redeemTxHash);
                logger.debug("checkXOnline: ", btcTx);
                if(btcTx && btcTx.confirmations && btcTx.confirmations>=config.btcConfirmBlocks){
                    record.status = 'refundFinished';
                    this.updateRecord(record );
                }
            }

        }catch(err){
            logger.error("checkXConfirm:", err);
        }
    },


    async checkRevokeConfirm(record, waitBlocks){
        try {
            if(record.chain == "BTC"){
                let btcTx = await be.getBtcTransaction(be.btcSender, record.btcRevokeTxHash);
                logger.debug("checkRevokeConfirm: ", btcTx);
                if(btcTx && btcTx.confirmations && btcTx.confirmations>=config.btcConfirmBlocks){
                    record.status = 'revokeFinished';
                    this.updateRecord(record );
                }
            }else{
                let sender = this.getSenderbyChain("WAN");
                let receipt = await this.monitorTxConfirm(sender, '0x'+record.revokeTxHash, waitBlocks);
                if(receipt){
                    record.revokeConfirmed += 1;
                    if(record.revokeConfirmed >= config.confirmBlocks){
                        record.status = 'revokeFinished';
                    }
                    this.updateRecord(record);
                }
            }
        }catch(err){
            logger.error("checkRevokeConfirm:", err);
        }
    },
    async checkCrossHashConfirm(record, waitBlocks){
        try {
            let sender;
            let receipt;
	        if(record.chain=="BTC"){
		        sender = this.getSenderbyChain("WAN");
		        receipt = await be.getDepositCrossLockEvent(sender,'0x'+record.HashX);
	        }else {
		        sender = this.getSenderbyChain("WAN");
		        receipt = await be.getBtcWithdrawStoremanNoticeEvent(sender,'0x'+record.HashX);
		        //console.log("checkCrossHashOnline WAN:", receipt);
		        //TODO: should we check btc, make sure value, trans is right, confirmed.
	        }

            if(receipt){
                if(!record.crossConfirmed) record.crossConfirmed = 0;
                record.crossConfirmed += 1;
                if(record.crossConfirmed >= config.confirmBlocks){
                    record.status = 'waitingX';
                    this.updateRecord(record);
                }
            }
        }catch(err){
            logger.error("checkCrossHashConfirm:", err);
        }
    },

    async checkHashTimeout( record){
        if(record.status === "sentHashFailed") {
            return false;
        }
        if(record.status == "waitingRevoke"
            || record.status =="sentRevokePending"
            || record.status =="sentRevokeConfirming"){
            return true;
        }
        try {
            let HTLCtime = Number(record.HTLCtime);
            // if(record.chain == 'BTC'){
	         //    HTLCtime = Number(record.btcRedeemLockTimeStamp);
            // }else {
	         //    HTLCtime = Number(record.HTLCtime);
            // }
            let suspendTime = Number(record.suspendTime);
            if(HTLCtime <= Date.now()){
                record.status = 'waitingRevoke';
                this.updateRecord(record);
                return true;
            }else if(suspendTime <= Date.now()){
                record.status = 'suspending';
                this.updateRecord(record);
                return true;
            }
        }catch(err){
            logger.error("checkHashTimeout:", err);
        }
        return false;
    },
    async checkCrossHashOnline(record){
        try {
            let receipt;
            let sender
            if(record.chain=="BTC"){
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getDepositCrossLockEvent(sender,'0x'+record.HashX);
                if(receipt && receipt.length>0){
                    record.crossConfirmed = 1;
                    record.crossLockHash = receipt[0].transactionHash;// the storeman notice hash.
                    record.status = 'waitingCrossConfirming';
                    logger.debug("checkCrossHashOnline record:", record);
                    this.updateRecord(record);
                }

            }else {
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getBtcWithdrawStoremanNoticeEvent(sender,'0x'+record.HashX);
                logger.debug("checkCrossHashOnline WAN:", receipt);
                //TODO: we need check btc, make sure value, trans is right, confirmed.
                if(receipt && receipt.length>0){
                    record.crossConfirmed = 1;
                    record.crossLockHash = receipt[0].transactionHash;// the storeman notice hash.
                    let redeemLockTimeStamp = Number('0x'+receipt[0].data.slice(66));
                    let btcLockTxHash = receipt[0].data.slice(2,66);
                    record.StoremanBtcH160 = receipt[0].topics[1].slice(26);
                    record.btcRedeemLockTimeStamp = redeemLockTimeStamp*1000;
                    record.btcLockTxHash = btcLockTxHash;
                    record.status = 'waitingCrossConfirming';
                    logger.debug("checkCrossHashOnline record:", record);
                    this.updateRecord(record);
                }
            }

        }catch(err){
            logger.error("checkCrossHashOnline:", err);
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
            logger.debug("tx timeout: ", record);
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
                if(record.chain == "BTC"){
                    if(record.refundTxHash){
                        record.status = 'sentXPending';
                        this.updateRecord(record);
                    }
                }else {
                    if(record.btcRefundTxHash){
                        record.status = 'sentXPending';
                        this.updateRecord(record);
                    }
                }
                break;
            case 'suspending':
                // do nothing.
                break;
            case 'waitingRevoke':
                let txhash;
                if(record.chain == "BTC"){
                    txhash = record.btcRevokeTxHash;
                }else {
                    txhash = record.revokeTxHash;
                }
                if(txhash){
                    record.status = 'sentRevokePending';
                    this.updateRecord(record);
                }
                break;
            case 'sentRevokePending':
                await this.checkRevokeOnline(record.chain, record);
                break;
            case 'sentRevokeConfirming':
                waitBlock = record.lockConfirmed < config.confirmBlocks ? record.lockConfirmed: config.confirmBlocks;
                await this.checkRevokeConfirm(record, waitBlock);
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
        if( handlingList[record.HashX]) {
            delete handlingList[record.HashX];
        }
    },
}


exports.MonitorRecord = MonitorRecord;
