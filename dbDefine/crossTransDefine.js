"use strict";

module.exports = {
    name : 'crossTransDbBtc',
    collections : [
        {
            name : 'normalTransaction',
            UID : 'txhash',
            ItemDefine : {
                txhash : '',
                from : '',
                to : '',
                value : '',
                time : '',
                chain : ''
            }
        },
        {
            name : 'btcCrossTransaction',
            UID: 'HashX',
            ItemDefine : {
                HashX : '',
                from : '',
                to: '', // SC addr
                storeman : '',
                crossAddress : '', // another chain address.
                value : '',  // the value in the input date
                txValue: '', // the value in the tx object, this is the native coin value;
                x : '',
                time : '',
                suspendTime:'',
                HTLCtime : '',
                chain : '',
                status: '', // sentHashPending, sentHashConfirming, sentHashFailed/waitingCross, waitingCrossConfirming, waitingX, sentXPending, sentXConfirming,refundFinished.
                            //                                                              suspending,waitingRevoke,sentRevokePending, sentRevokeConfirming, revokeFinished.
                lockConfirmed:0,
                refundConfirmed:0,
                revokeConfirmed:0,
                crossConfirmed:0,
                crossLockHash:'',
                txhash : '',
                lockTxHash: '',
                refundTxHash: '',
                revokeTxHash : '',

                btcRedeemLockTimeStamp:'',//btc script timeout time
                btcNoticeTxhash : '',
                btcLockTxHash: '',
                btcRefundTxHash: '',
                btcRevokeTxHash : ''
            }
        },
        {
            name : 'crossTransaction',
            UID: 'HashX',
            ItemDefine : {
                HashX : '',
                from : '',
                to: '', // SC addr
                storeman : '',
                crossAddress : '', // another chain address.
                value : '',  // the value in the input date
                txValue: '', // the value in the tx object, this is the native coin value;
                x : '',
                time : '',
                suspendTime:'',
                HTLCtime : '',
                chain : '',
                status: '', // sentHashPending, sentHashConfirming, sentHashFailed/waitingCross, waitingCrossConfirming, waitingX, sentXPending, sentXConfirming,refundFinished.
                            //                                                              suspending,waitingRevoke,sentRevokePending, sentRevokeConfirming, revokeFinished.
                lockConfirmed:0,
                refundConfirmed:0,
                revokeConfirmed:0,
                crossConfirmed:0,
                crossLockHash:'',
                txhash : '',
                lockTxHash: '',
                refundTxHash: '',
                revokeTxHash : '',

                btcRedeemLockTimeStamp:'',//btc script timeout time
                btcNoticeTxhash : '',
                btcLockTxHash: '',
                btcRefundTxHash: '',
                btcRevokeTxHash : ''
            }
        },

/*        {
            name : 'btcCrossTransaction',
            UID: 'HashX',
            ItemDefine : {
                HashX : '',
                from : '',          //wan:sender address,                       btc:senderH160Addr
                to: '',             //wan:smart contract address                btc:script psh address
                storeman : '',      //wan:storeman address                      btc:ReceiverHash160Addr
                crossAddress : '',   //wan: sender btc chain senderH160Addr      btc:wan chain address
                value : '',         //wan:the value for sc input para value     btc:the value for send to psh address
                txValue: '',        //the native coin value
                x : '',             //X value for refund
                time : '',          //the transaction time
                suspendTime:'',     //the time span from lock                   record.suspendTime = (1000*Number(global.lockedTime)+newtime).toString();
                HTLCtime : '',      //the time span from for htlc timeout       record.HTLCtime = (100000+2*1000*Number(global.lockedTime)+newtime).toString();
                chain : '',         //wan:'WAN'                                  btc:'BTC'
                status: '',         //sentHashPending, sentHashConfirming, sentHashFailed/waitingCross, waitingCrossConfirming, waitingX, sentXPending, sentXConfirming,refundFinished.
                                    //suspending,waitingRevoke,sentRevokePending, sentRevokeConfirming, revokeFinished.
                lockConfirmed:0,    //the confirmed block number for lock  transaction
                refundConfirmed:0,  //the confrmed block number for refund transaction
                revokeConfirmed:0,  //the confrmed block number for revoke transaction
                crossConfirmed:0,   //the confirmed block number after loch hashC
                crossLockHash:'',   //the lock hash for the cross chain
                txhash : '',        //normanl transaction hash
                lockTxHash: '',     //the lock txHash
                refundTxHash: '',   //the refund txHash
                revokeTxHash : '',   //the revoke txHash
                btcRedeemLockTimeStamp:''//btc script timeout time
                btcNoticeTxhash : '',
                btcLockTxHash: '',
                btcRefundTxHash: '',
                btcRevokeTxHash : ''
            }
        }
*/

     ]

}