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
        try {
            if (trans.crossType == 'BTC2WAN') {
                let collection =  this.getBtcCrossCollection();
                let cur = Date.now()
                let obj = {
                    HashX: trans.hashx,
                    from: trans.from,
                    to: trans.to,
                    storeman: trans.storeman,
                    crossAdress: '',
                    value: trans.amount,
                    txValue: trans.value,
                    x: trans.x,
                    time: cur.toString(),
                    HTLCtime: (3000000 + 2 * 1000 * Number(global.lockedTime) + cur).toString(),
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
                return {error: new Error('Not supported cross chain type')}
            }

        }

        catch (e) {
            return {error: e}
        }

    }

    insertNormalData(trans) {
        try {
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
                return {error: new Error('Not supported cross chain type')}
            }

        } catch (e) {
            return {error: e}
        }
    }

    insertRefundData(trans, crossType) {
        try {
            let collection =  this.getBtcCrossCollection();
            let value = null

            if (trans.crossType == 'BTC2WAN') {
                value = collection.findOne({HashX: trans.hashx})
            } else {
                return {error: new Error('Not supported cross chain type')}
            }

            if (value != null) {
                value.btcRefundTxHash = trans.refundTxHash;
                //value.status = 'refundFinished';
                let res = collection.update(value);
                logger.debug("refund item=");
                logger.debug(res);

            } else {
                return {error: new Error('Value not find in db')}
            }
        } catch (e) {
            return {error: e}
        }

    }

    insertRevokeData(trans) {
        try {
            let collection =  this.getBtcCrossCollection();
            let value = null
            if (trans.crossType == 'BTC2WAN') {
                value = collection.findOne({HashX: trans.hashx})
            } else {
                return {error: new Error('Not supported cross chain type')}
            }

            if (value != null) {
                value.btcRevokeTxHash = trans.revokeTxHash;
                value.status = 'revokeFinished'
                let res = collection.update(value)
                logger.debug("revoke item=");
                logger.debug(res);
            } else {
                return {error: new Error('Value not find in db')}
            }
        } catch (e) {
            return {error: e}
        }

    }

    insertWanNoticeData(trans) {

        try {
            let collection =  this.getBtcCrossCollection();
            let value = null
            if (trans.crossType == 'BTC2WAN') {
                value = collection.findOne({HashX: trans.hashx})
            } else {
                return {error: new Error('Not supported cross chain type')}
            }

            if (value != null) {
                value.crossAdress = trans.crossAddress;
                value.btcNoticeTxhash = trans.btcNoticeTxhash;
                value.status = "sentHashPending";

                let res = collection.update(value)
                logger.debug("wan notice item=");
                logger.debug(res);
            } else {
                return {error: new Error('Value not find in db')}
            }
        } catch (e) {
            return {error: e}
        }

    }
}
