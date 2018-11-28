'use strict';

const pu = require('promisefy-util');
let config;
const be = require('./ccUtil.js').Backend;
const btcUtil = require('./btcUtil').btcUtil;
const cm = require('./comm.js');
const Web3 = require("web3");
const web3 = new Web3();
const coder = require('web3/lib/solidity/coder');

let backendConfig = {};
let logger;
let handlingList = {};

function encodeTopic(type, param) {
    return '0x' + coder.encodeParam(type, param);
}
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
        return chainType === "BTC"? this.btcSender : this.wanSender;
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
        let history = collection.find({ 'status' : { '$nin' : ['redeemFinished','revokeFinished','sentHashFailed'] } });
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
            if(record.chain === "BTC"){
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
    async checkXOnlineBtc(record){
        try {
            let redeemTxHash = record.btcRefundTxHash;
            let btcTx = await be.getBtcTransaction(be.btcSender, redeemTxHash);
            logger.debug("checkXOnline: ", btcTx);
            if(btcTx && btcTx.confirmations && btcTx.confirmations>0) {
                record.status = 'sentXConfirming';
                this.updateRecord(record);
            }
        }catch(err){
            logger.error("checkTxOnline:", err);
        }
    },
    async checkRevokeOnlineBtc(record){
        try {
            let btcTx = await be.getBtcTransaction(be.btcSender, record.btcRevokeTxHash);
            logger.debug("checkRevokeOnline: ", btcTx);
            if(btcTx && btcTx.confirmations && btcTx.confirmations>=1){
                record.status = 'sentRevokeConfirming';
                this.updateRecord(record );
            }
        }catch(err){
            //console.log("checkRevokeOnline:", err);
        }
    },
    async checkHashConfirmWan(record){
        try {
            let sender = this.getSenderbyChain("WAN");
	        let txhash = '0x'+record.lockTxHash;
            let waitBlock = record.lockConfirmed < config.confirmBlocks ? record.lockConfirmed: config.confirmBlocks;
            let receipt = await this.monitorTxConfirm(sender, txhash, waitBlock);
            logger.debug("checkHashConfirmWan: ", receipt);
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
    async checkXOnlineWan(record){
        try {
            let sender = this.getSenderbyChain("WAN");
            let txhash = '0x'+record.refundTxHash;
            let receipt = await this.monitorTxConfirm(sender, txhash, 0);
            logger.debug("checkRedeemConfirmWan: ", receipt);
            if(receipt){
                if(receipt.status === '0x1'){
                    record.status = 'sentXConfirming';
                }else{
                    record.status = 'sentRedeemFailed';
                }
                this.updateRecord(record);
            }
        }catch(err){
            //console.log("checkHashConfirm:", err);
        }
    },
    async checkRevokeOnlineWan(record){
        try {
            let sender = this.getSenderbyChain("WAN");
            let txhash = '0x'+record.revokeTxHash;
            let receipt = await this.monitorTxConfirm(sender, txhash, 0);
            logger.debug("checkRevokeConfirmWan: ", receipt);
            if(receipt){
                if(receipt.status === '0x1'){
                    record.status = 'sentRevokeConfirming';
                }else{
                    record.status = 'sentRevokeFailed';
                }
                this.updateRecord(record);
            }
        }catch(err){
            //console.log("checkHashConfirm:", err);
        }
    },
    async checkHashConfirmBtc(record){
        try {
            let sender = this.getSenderbyChain('BTC');
            let txhash = record.btcLockTxHash;
            let btcTx = await be.getBtcTransaction(sender, txhash);
            logger.debug("checkHashConfirmBtc btcTx: ", btcTx);
            if(btcTx && btcTx.confirmations && btcTx.confirmations>=config.btcConfirmBlocks){
                record.status = 'waitingCross';
                this.updateRecord(record );
            }
        }catch(err){
            logger.debug("checkHashConfirmBtc:", err);
        }
    },
    async checkHashReceiptOnlineWan(record){
        try {
            let sender = this.getSenderbyChain('WAN');
            let txhash = '0x'+record.lockTxHash;
            let receipt = await this.monitorTxConfirm(sender, txhash, 0);
            if(receipt){
                if(receipt.status === '0x1'){
                    // update the time to block time.
                    let block = await be.getBlockByNumber(sender, receipt.blockNumber);
                    let newtime = Number(block.timestamp)*1000;
                    record.time = newtime.toString();
                    record.suspendTime = (1000*Number(cm.lockedTime)+newtime).toString();
                    record.HTLCtime = (2*60*60*1000+2*1000*Number(cm.lockedTime)+newtime).toString();// extra 2 hours, because btc locktime need more than 5 blocks.
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
    async checkHashReceiptOnlineBtc(record){
        try {
            let sender = this.getSenderbyChain('BTC');
            let txhash = record.btcLockTxHash;
            let btcTx = await be.getBtcTransaction(sender, txhash);
            logger.debug("checkHashReceiptOnlineBtc btcTx: ", btcTx);
            if(btcTx){
                record.status = 'sentHashConfirming';
                this.updateRecord(record);
            }
        }catch(err){
            logger.debug("checkHashReceiptOnlineBtc:", err);
        }
    },
    async checkXConfirm(record){
        try {
            if(record.chain === "BTC"){
                let waitBlock = record.refundConfirmed < config.confirmBlocks ? record.refundConfirmed: config.confirmBlocks;
                let sender = this.getSenderbyChain('WAN');
                let receipt = await this.monitorTxConfirm(sender, '0x'+record.refundTxHash, waitBlock);
                if(receipt){
                    record.refundConfirmed += 1;
                    if(record.refundConfirmed >= config.confirmBlocks){
                        record.status = 'redeemFinished';
                    }
                    this.updateRecord(record);
                }

            }else{
                let redeemTxHash = record.btcRefundTxHash;
                let btcTx = await be.getBtcTransaction(be.btcSender, redeemTxHash);
                logger.debug("checkXOnline: ", btcTx);
                if(btcTx && btcTx.confirmations && btcTx.confirmations>=config.btcConfirmBlocks){
                    record.status = 'redeemFinished';
                    this.updateRecord(record );
                }
            }

        }catch(err){
            logger.error("checkXConfirm:", err);
        }
    },


    async checkRevokeConfirm(record){
        try {
            if(record.chain === "BTC"){
                let btcTx = await be.getBtcTransaction(be.btcSender, record.btcRevokeTxHash);
                logger.debug("checkRevokeConfirm: ", btcTx);
                if(btcTx && btcTx.confirmations && btcTx.confirmations>=config.btcConfirmBlocks){
                    record.status = 'revokeFinished';
                    this.updateRecord(record );
                }
            }else{
                let sender = this.getSenderbyChain("WAN");
                let waitBlock = record.revokeConfirmed < config.confirmBlocks ? record.revokeConfirmed: config.confirmBlocks;
                let receipt = await this.monitorTxConfirm(sender, '0x'+record.revokeTxHash, waitBlock);
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
    async checkCrossHashConfirmDeposit(record){
        try {
            let sender = this.getSenderbyChain("WAN");
            let waitBlock = record.crossConfirmed < config.confirmBlocks ? record.crossConfirmed: config.confirmBlocks;
            let receipt = await this.monitorTxConfirm(sender, record.crossLockHash, waitBlock);
            logger.debug("checkCrossHashConfirmDeposit receipt: ", receipt);
            if(receipt){
                if(!record.crossConfirmed) record.crossConfirmed = 0;
                record.crossConfirmed += 1;
                if(record.crossConfirmed >= config.confirmBlocks){
                    record.status = 'waitingX';
                    this.updateRecord(record);
                }
            }
        }catch(err){
            logger.error("checkCrossHashConfirmDeposit:", err);
        }
    },
    async checkCrossHashConfirmWithdraw(record){
        try {
            let btcSender = this.getSenderbyChain('BTC');
            let btcTx = await be.getBtcTransaction(btcSender, record.btcLockTxHash);
            logger.debug("checkCrossHashConfirmWithdraw btcTx:", btcTx);
            if(btcTx && btcTx.confirmations && btcTx.confirmations>=config.btcConfirmBlocks){
                record.status = 'waitingX';
                this.updateRecord(record );
            }
        }catch(err){
            logger.error("checkCrossHashConfirm:", err);
        }
    },
    async checkHashTimeout( record){
        if(record.status === "sentHashFailed") {
            return false;
        }
        if(record.status === "waitingRevoke"
            || record.status ==="sentRevokePending"
            || record.status ==="sentRevokeFailed"
            || record.status ==="sentRevokeConfirming"){
            return true;
        }
        try {
            let HTLCtime = Number(record.HTLCtime);
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
            let sender;
            if(record.chain==="BTC"){
                sender = this.getSenderbyChain("WAN");
                receipt = await be.getDepositCrossLockEvent(sender,'0x'+record.HashX, encodeTopic("address", '0x'+record.crossAddress));
                logger.debug("checkCrossHashOnline deposit: ", receipt);
                if(receipt && receipt.length>0){
                    record.crossConfirmed = 1;
                    record.crossLockHash = receipt[0].transactionHash;// the storeman notice hash.
                    let value = web3.toBigNumber(receipt[0].data).toString(10);
                    if(value == record.value){
                        record.status = 'waitingCrossConfirming';
                        logger.debug("checkCrossHashOnline record:", record);
                        this.updateRecord(record);
                    } else {
                        logger.debug("invalid value of cross transaction: ", record, receipt);
                    }
                }
            }else {
                sender = this.getSenderbyChain("WAN");
                // in btc record, crossAddress has no 0x, but wan record has 0x
                receipt = await be.getBtcWithdrawStoremanNoticeEvent(sender,'0x'+record.HashX, encodeTopic("address", record.crossAddress));
                logger.debug("checkCrossHashOnline WAN:", receipt);
                if(receipt && receipt.length>0){
                    let btcLockTxHash = receipt[0].data.slice(2,66);
                    let redeemLockTimeStamp = Number('0x'+receipt[0].data.slice(66));
                    let StoremanBtcH160 = receipt[0].topics[1].slice(26);
                    let btcSender = this.getSenderbyChain('BTC');
                    let btcTx = await be.getBtcTransaction(btcSender, btcLockTxHash);
                    logger.debug("checkCrossHashOnline btcTx:", btcTx);
                    let contract = btcUtil.hashtimelockcontract(record.HashX, redeemLockTimeStamp, record.crossAddress, StoremanBtcH160)

                    if(btcTx && btcTx.confirmations && btcTx.locktime===0) {
                        let  btcTx_value = Number(web3.toBigNumber(btcTx.vout[0].value).mul(100000000));
                        let  btcTx_p2sh = btcTx.vout[0].scriptPubKey.addresses[0];
                        if(btcTx_value === Number(record.value) && btcTx_p2sh ===contract.p2sh){
                            record.crossConfirmed = 1;
                            record.crossLockHash = receipt[0].transactionHash;// the storeman notice hash.
                            record.StoremanBtcH160 = StoremanBtcH160;
                            record.btcRedeemLockTimeStamp = redeemLockTimeStamp*1000;
                            record.btcLockTxHash = btcLockTxHash;
                            record.status = 'waitingCrossConfirming';
                            logger.debug("checkCrossHashOnline record:", record);
                            this.updateRecord(record);
                        } else {
                            logger.error("checkCrossHashOnline invalid value: ",btcTx_value, record.value)
                        }
                    }
                }
            }
        }catch(err){
            logger.error("checkCrossHashOnline:", err.message||err);
        }
    },
    updateRecord(record){
        let collection = be.getCrossdbCollection();
        collection.update(record);
    },



    async monitorRecord(record){
        if(this.checkHashTimeout(record) == true){
            logger.debug("tx timeout: ", record);
        }
        //logger.debug("record status is ", record.status);
        switch(record.status) {
            case 'sentHashPending':
                if(record.chain === 'BTC') {
                    await this.checkHashReceiptOnlineBtc(record);
                } else {
                    await this.checkHashReceiptOnlineWan(record);
                }
                break;
            case 'sentHashConfirming':
                if(record.chain === 'BTC') {
                    await this.checkHashConfirmBtc(record);
                } else {
                    await this.checkHashConfirmWan(record);
                }
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
                if(record.chain === 'BTC') {
                    await this.checkCrossHashConfirmDeposit(record);
                } else {
                    await this.checkCrossHashConfirmWithdraw(record);
                }
                break;
            case 'waitingX':
                // if(record.chain === "BTC"){
                //     if(record.refundTxHash){
                //         record.status = 'sentXPending';
                //         this.updateRecord(record);
                //     }
                // }else {
                //     if(record.btcRefundTxHash){
                //         record.status = 'sentXPending';
                //         this.updateRecord(record);
                //     }
                // }
                break;
            case 'suspending':
                // do nothing.
                break;
            case 'sentRevokeFailed':
                break;
            case 'sentRedeemFailed':
                break;
            case 'waitingRevoke':
                // let txhash;
                // if(record.chain === "BTC"){
                //     txhash = record.btcRevokeTxHash;
                // }else {
                //     txhash = record.revokeTxHash;
                // }
                // if(txhash){
                //     record.status = 'sentRevokePending';
                //     this.updateRecord(record);
                // }
                break;
            case 'sentRevokePending':
                if(record.chain === 'BTC') {
                    await this.checkRevokeOnlineBtc(record);
                } else {
                    await this.checkRevokeOnlineWan(record);
                }
                break;
            case 'sentRevokeConfirming':
                await this.checkRevokeConfirm(record);
                break;

            case 'sentXPending':
                if(record.chain === 'BTC') {
                    await this.checkXOnlineWan(record);
                } else {
                    await this.checkXOnlineBtc(record);
                }
                break;
            case 'sentXConfirming':
                await this.checkXConfirm(record);
                break;

            case 'redeemFinished':
            case 'revokeFinished':
                break;
            default:
                break;
        }
        if( handlingList[record.HashX]) {
            delete handlingList[record.HashX];
        }
    },
};


exports.MonitorRecord = MonitorRecord;
