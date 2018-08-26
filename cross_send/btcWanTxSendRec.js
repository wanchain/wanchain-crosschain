'use strict'

let dbname = 'crossTransDb'
let wanHashXSend = require('../wanchaintrans/index.js').wanHashXSend
let btcHashXSend = require('../wanchaintrans/index.js').btcHashXSend

let NormalSend = require('../wanchaintrans/index.js').NormalSend
let TokenSend = require('../wanchaintrans/interface/transaction.js').TokenSend
const Web3 = require('web3')
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
let logDebug

module.exports = class btcWanTxSendRec {

  constructor () {
    logDebug = global.getLogger('sendTransaction')
  }

  insertLockData (ctx) {

    let trans = ctx

    try {
      if (trans.crossType == 'BTC2WAN') {
        global.getCollectionCb(dbname, 'crossTransaction', function (collection) {
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
            HTLCtime: '',
            chain: 'BTC',
            status: 'sentHashPending',
            lockConfirmed: 0,
            refundConfirmed: 0,
            revokeConfirmed: 0,
            lockTxHash: '',
            refundTxHash: '',
            revokeTxHash: '',
            btcRedeemLockTimeStamp: 1000*trans.redeemLockTimeStamp,
            btcNoticeTxhash : '',
            btcLockTxHash: trans.lockTxHash,
            btcRefundTxHash: '',
            btcRevokeTxHash : ''
          }

          let res = collection.insert(obj)
          console.log('insert obj = ')
          console.log(res)
        })

      } else {
        return {error: new Error('Not supported cross chain type')}
      }

    }

    catch (e) {
      return {error: e}
    }

  }

  insertNormalData (trans) {
    try {
      global.getCollectionCb(dbname, 'crossTransaction', function (collection) {
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
      })
    } catch (e) {
      return {error: e}
    }
  }

  insertRefundData (trans, crossType) {

    try {
      global.getCollectionCb(dbname, 'crossTransaction', function (collection) {
        let value = null

        if (trans.crossType == 'BTC2WAN') {
          value = collection.findOne({HashX: trans.hashx})
        } else {
          return {error: new Error('Not supported cross chain type')}
        }

        if (value != null) {

          value.btcRefundTxHash = trans.refundTxHash;
          value.status = 'refundFinished';
          let res = collection.update(value);
          console.log("refund item=");
          console.log(res);

        } else {
          return {error: new Error('Value not find in db')}
        }
      })
    } catch (e) {
      return {error: e}
    }

  }

  insertRevokeData (trans) {

    try {
      global.getCollectionCb(dbname, 'crossTransaction', function (collection) {

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
          console.log("revoke item=");
          console.log(res);
        } else {
          return {error: new Error('Value not find in db')}
        }

      })
    } catch (e) {
      return {error: e}
    }

  }

  insertWanNoticeData (trans) {

    try {
      global.getCollectionCb(dbname, 'crossTransaction', function (collection) {

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
          console.log("wan notice item=");
          console.log(res);
        } else {
          return {error: new Error('Value not find in db')}
        }

      })
    } catch (e) {
      return {error: e}
    }

  }

}