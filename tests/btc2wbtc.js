const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;
const Web3 = require("web3");
var web3 = new Web3();
let utils = require('./utils/script');


describe('BTC-TO-WBTC Crosschain Transaction', () => {
    
    let client;
    let wanchainCore;
    let ccUtil;
    let btcUtil;

    let btcNetwork = bitcoin.networks.testnet;
    let btcNetworkName = 'testnet';

    let defaultBtcAddressList;
    let defaultBtcPasswd = '1234567890';

    let defaultWanAddress;
    let defaultWanBalance;
    let defaultBtcBalance;
    let defaultWanPasswd = 'astroastro';

    let defaultStoreman;

    let defaultBTC2WBTCAmount = 0.0002;

    let print4debug = console.log;


    let redeemRecords = [];
    let redeemShowArray = [];
    let redeemRecord;

    let revokeRecords = [];
    let revokeShowArray = [];
    let revokeRecord;

    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
    });

    describe('Lock Transaction', () => {

        it('BTC and WAN Balance gt 0', async () => {
            try {

                let defaultWAN = (await ccUtil.getWanAccountsInfo(ccUtil.wanSender))[0];
                defaultWanAddress = defaultWAN.address;
                defaultWanBalance = defaultWAN.balance;

                defaultBtcAddressList = await btcUtil.getAddressList();
                
                let array = [];

                for (let i=0;i<defaultBtcAddressList.length; i++) {
                    array.push(defaultBtcAddressList[i].address)
                }

                let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, config.MIN_CONFIRM_BLKS, config.MAX_CONFIRM_BLKS, array);
                let result = await ccUtil.getUTXOSBalance(utxos);

                defaultBtcBalance = web3.toBigNumber(result).div(100000000).toString();
                
            } catch(e) {
                print4debug(`Get Account Balance Error: ${e}`);
            }

            assert.notStrictEqual(defaultWanBalance, '0');
            assert.notStrictEqual(defaultBtcBalance, '0');
        })

        it('Have storeman and balance gt 0', async () => {
            try{
                
                defaultStoreman = (await ccUtil.getBtcSmgList(ccUtil.btcSender))[0];
                // print4debug('defaultStoreman: ', defaultStoreman);
    
            } catch (e) {
                print4debug(`Get Storeman Balance Error: ${e}`);
            }

            assert.notStrictEqual(defaultStoreman.inboundQuota, '0');
        })

        it('Send Lock BTC Transaction', async () => {

            let txHash;

            try {
                let record;
                let keyPairArray = [];
                
                let addressList = await btcUtil.getAddressList();
                addressList = await ccUtil.filterBtcAddressByAmount(addressList, defaultBTC2WBTCAmount);
    
                for (let i = 0; i < addressList.length; i++) {
                    let kp = await btcUtil.getECPairsbyAddr(defaultBtcPasswd, addressList[i]);
                    keyPairArray.push(kp);
                }
    
                let value = Number(web3.toBigNumber(defaultBTC2WBTCAmount).mul(100000000));
                record = await ccUtil.fund(keyPairArray, defaultStoreman.btcAddress, value);
                                    
                // notice wan.
                const tx = {};
                tx.storeman = defaultStoreman.wanAddress;
                tx.from = defaultWanAddress;
                tx.userH160 = '0x'+bitcoin.crypto.hash160(keyPairArray[0].publicKey).toString('hex');
                tx.hashx = '0x'+record.hashx;
                tx.txHash = '0x'+record.txhash;
                tx.lockedTimestamp = record.redeemLockTimeStamp;
                tx.gas = config.gasLimit;
                tx.gasPrice = config.gasPrice;
                tx.passwd= defaultWanPasswd;
                                    
                txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
    
                print4debug('txHash: ', txHash);
            } catch (e) {
                print4debug(`Send Lock Transaction Error: ${e}`);
            }

            assert.strictEqual(utils.checkHash(txHash), true);
        })
    })

    describe('Redeem BTC Transaction', () => {

        // listTransaction
        let redeemHash;

        it('Send Redeem Transaction', async () => {

            try {

                redeemRecords = await ccUtil.getBtcWanTxHistory({status: 'waitingX', chain: 'BTC'});
                redeemShowArray = utils.checkTransaction(redeemRecords, web3, btcUtil.hash160ToAddress);

                if (redeemShowArray.length > 0) {
                    redeemRecord = redeemShowArray[0];
                    redeemHash = await ccUtil.sendDepositX(ccUtil.wanSender, '0x'+redeemRecord.crossAddress, config.gasLimit, config.gasPrice,'0x'+redeemRecord.x, defaultWanPasswd);
    
                    print4debug("redeemHash: ", redeemHash);
                } else {
                    print4debug("No Redeem Transfer");
                }

            } catch (e) {
                print4debug(`Send Redeem Transaction Error: ${e}`);
            }

            assert.strictEqual(utils.checkHash(redeemHash), true);
        })
    })

    describe('Revoke Transaction', () => {

        // listTransaction
        let revokeHash;

        it('Send Revoke Transaction', async () => {

            try{
                revokeRecords = await ccUtil.getBtcWanTxHistory({status: 'waitingRevoke', chain: 'BTC'});
                revokeShowArray = utils.checkTransaction(revokeRecords, web3, btcUtil.hash160ToAddress);

                if (revokeShowArray.length > 0) {
                    revokeRecord = revokeShowArray[0];
                    
                    let alice = await btcUtil.getECPairsbyAddr(defaultBtcPasswd, revokeRecord.from);

                    revokeHash = await ccUtil.revokeWithHashX(revokeRecord.HashX,alice);

                    print4debug("revokeHash: ", revokeHash);

                } else {
                    print4debug("No Revoke Transfer");
                }

            } catch (e) {
                print4debug(`Send Revoke Transaction Error: ${e}`);
            }

            assert.strictEqual(utils.checkHash(revokeHash), true);
        });
    })

}); 