'use strict'

const cm = require('../comm.js');

let logger;

module.exports = class btcWanTxSendRec {

    constructor() {
        logger = cm.getLogger('sendTransaction')
    }

    getBtcCrossCollection() {
        return cm.crossDb.getCollection(cm.config.crossCollection);
    }

    insertLockData(ctx) {
        let trans = ctx
        if (trans.crossType == 'BTC2WAN') {
            let collection =  this.getBtcCrossCollection();
            let cur = Date.now()
            let obj = {
                HashX: trans.hashx,
                from: trans.from,
                to: trans.to,
                storeman: trans.storeman,
                crossAddress: '',
                value: trans.amount,
                txValue: trans.value,
                x: trans.x,
                time: cur.toString(),
                HTLCtime: (2*60*60*1000 + 2 * 1000 * Number(cm.lockedTime) + cur).toString(),
                suspendTime: (1000*Number(cm.lockedTime)+cur).toString(),
                chain: 'BTC',
                status: 'sentHashPending',
                lockConfirmed: 0,
                refundConfirmed: 0,
                revokeConfirmed: 0,
                lockTxHash: '',
                refundTxHash: '',
                revokeTxHash: '',
                btcRedeemLockTimeStamp: 1000 * trans.redeemLockTimeStamp,
                btcNoticeTxhash: '',
                btcLockTxHash: trans.lockTxHash,
                btcRefundTxHash: '',
                btcRevokeTxHash: ''
            }

            let res = collection.insert(obj)
            logger.debug('insert obj = ')
            logger.debug(res)
        } else {
            throw(new Error('Not supported cross chain type'));
        }
    }

    insertNormalData(trans) {
        let collection =  this.getBtcCrossCollection();
        if (trans.crossType == 'BTC2WAN') {
            collection.insert(
                {
                    from: trans.from,
                    to: trans.to,
                    value: trans.value.toString(10),
                    time: Date.now().toString(),
                    txhash: trans.txHash,
                    chain: 'BTC',
                })
            return null
        } else {
            throw(new Error('Not supported cross chain type'));
        }
    }

    insertRefundData(trans, crossType) {
        let collection =  this.getBtcCrossCollection();
        let value = null

        if (trans.crossType == 'BTC2WAN') {
            value = collection.findOne({HashX: trans.hashx})
        } else {
            throw(new Error('Not supported cross chain type'));
        }
        if (value != null) {
            value.btcRefundTxHash = trans.refundTxHash;
            value.status = 'sentXPending';
            let res = collection.update(value);
            logger.debug("refund item=");
            logger.debug(res);

        } else {
            if(cm.config.isStoreman){
                trans.btcRefundTxHash = trans.refundTxHash;
                let res = collection.insert(trans);
                logger.info("storeman refund item=");
                logger.info(trans);
            }else{
                throw(new Error('Value not find in db'));
            }
        }
    }

    insertRevokeData(trans) {
        let collection =  this.getBtcCrossCollection();
        let value = null
        if (trans.crossType == 'BTC2WAN') {
            value = collection.findOne({HashX: trans.hashx})
        } else {
            throw(new Error('Not supported cross chain type'));
        }
        if (value != null) {
            value.btcRevokeTxHash = trans.revokeTxHash;
            value.status = 'sentRevokePending';
            let res = collection.update(value);
            logger.debug("revoke item:", res);
        } else {
            throw(new Error('Value not find in db'));
        }
    }

    insertWanNoticeData(trans) {
        let collection =  this.getBtcCrossCollection();
        let value = null
        if (trans.crossType == 'BTC2WAN') {
            value = collection.findOne({HashX: trans.hashx})
        } else {
            throw(new Error('Not supported cross chain type'));
        }

        if (value != null) {
            value.crossAddress = trans.crossAddress;
            value.btcNoticeTxhash = trans.btcNoticeTxhash;
            value.status = "sentHashPending";

            let res = collection.update(value);
            logger.debug("wan notice item=");
            logger.debug(res);
        } else {
            throw(new Error('Value not find in db'));
        }
    }
}
