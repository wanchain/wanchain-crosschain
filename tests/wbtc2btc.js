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
    let defaultWBTCBalance;
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
                defaultWBTCBalance = defaultWAN.tokenBalance;

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

            assert.notStrictEqual(defaultWBTCBalance, '0');
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

        it('Send Lock WBTC Transaction', async () => {

            let wdHash;

            try {
                let wdTx = {};
                let txFeeRatio;

                wdTx.gas = config.gasLimit;
                wdTx.gasPrice = config.gasPrice;
                wdTx.passwd = defaultWanPasswd;
                
                let btcAddr = (await btcUtil.getAddressList())[0];
                wdTx.cross = '0x' + btcUtil.addressToHash160(btcAddr.address, 'pubkeyhash','testnet');
                wdTx.from = (await ccUtil.getWanAccountsInfo(ccUtil.wanSender))[0].address;
                wdTx.amount = Number(web3.toBigNumber(defaultBTC2WBTCAmount).mul(100000000));

                smgs = (await ccUtil.getBtcSmgList(ccUtil.btcSender))[0];
                wdTx.storemanGroup = smgs.wanAddress;
                txFeeRatio = smgs.txFeeRatio;
                
                wdTx.value = ccUtil.calculateLocWanFee(wdTx.amount, ccUtil.c2wRatio, txFeeRatio);

                let x = btcUtil.generatePrivateKey().slice(2);
                wdTx.x = x;
                
                wdHash = await ccUtil.sendWanHash(ccUtil.wanSender, wdTx);
                
                console.log("wdHash: ", wdHash);
            } catch (e) {
                print4debug(`Send Lock Transaction Error: ${e}`);
            }

            assert.strictEqual(utils.checkHash(wdHash), true);
        })
    })

    describe('Redeem WBTC Transaction', () => {

        // listTransaction
        let redeemHash;

        it('Send Redeem Transaction', async () => {

            try {
                redeemRecords = await ccUtil.getBtcWanTxHistory({status: 'waitingX', chain: 'WAN'});
                redeemShowArray = utils.checkTransaction(redeemRecords, web3, btcUtil.hash160ToAddress);

                if (redeemShowArray.length > 0) {

                    redeemRecord = redeemShowArray[0];;

                    let aliceAddr = btcUtil.hash160ToAddress(redeemRecord.crossAddress,'pubkeyhash','testnet');
                    let alice = await btcUtil.getECPairsbyAddr(defaultBtcPasswd,  aliceAddr);
    
                    redeemHash = await ccUtil.redeemWithHashX(record.HashX, alice);
                } else {
                    print4debug("No Redeem Transfer");
                }

            } catch (e) {
                print4debug(`Send Redeem Transaction Error: ${e}`);
            }

            assert.strictEqual(utils.checkHash(redeemHash), true);
        })
    })

    describe('Revoke WBTC Transaction', () => {

        // listTransaction
        let revokeHash;

        it('Send Revoke Transaction', async () => {

            try{
                revokeRecords = await ccUtil.getBtcWanTxHistory({status: 'waitingRevoke', chain: 'WAN'});
                revokeShowArray = utils.checkTransaction(revokeRecords, web3, btcUtil.hash160ToAddress);

                if (revokeShowArray.length > 0) {
                    revokeRecord = revokeShowArray[0];

                    revokeHash = await ccUtil.sendWanCancel(ccUtil.wanSender, revokeRecord.from,
                        config.gasLimit, config.gasPrice, '0x'+revokeRecord.HashX, defaultWanPasswd);

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