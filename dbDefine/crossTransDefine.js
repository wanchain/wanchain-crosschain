"use strict";

module.exports = {
    name : 'crossTransDb',
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
            name : 'crossTransaction',
            UID: 'HashX',
            ItemDefine : {
                HashX : '',
                from : '',
                to: '', // SC addr
                storeman : '',
                crossAdress : '', // another chain address.
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
                revokeTxHash : ''
            }
        }
    ]

}