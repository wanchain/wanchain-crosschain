'use strict';

const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;
const Web3 = require("web3");
var web3 = new Web3();

let client;

let wanchainCore;
let ccUtil;
let btcUtil;


const btcNetwork = bitcoin.networks.testnet;
const btcNetworkName = 'testnet';


const storemanWif = 'cQrhq6e1bWZ8YBqaPcg5Q8vwdhEwwq1RNsMmv2opPQ4fuW2u8HYn';
const aliceWif = 'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5';
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, btcNetwork
);
const alice = bitcoin.ECPair.fromWIF(
    aliceWif, btcNetwork
);
let aliceAddr;
let aliceH160;
let storemanH160 = '83e5ca256c9ffd0ae019f98e4371e67ef5026d2d';



describe('btc2wbtc test', ()=> {
    const value = 200000;
    let lockBtcRecord={
        x: 'c1ac35598a2f10f46bc47828a561ed2bdb915dce66a17e888690aacf7ab8b481',
        hashx: '450f16867c2c4673c9db1e98fbe255a251dc301269c8650547bb0fbdbe03a6db',
        LockedTimestamp: 1541592184,
        value: value,
        txhash: '87c99d8cf01436d8760fa5ebbefb29de52abf08aa6c6afb974e948671d809547',
        senderH160Addr: '7ef9142e7d6f28dda806accb891e4054d6fa9eae',
    };
    before(async () => {
        config.wanchainHtlcAddr = "0xb248ed04e1f1bbb661b56f210e4b0399b2899d16";
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        console.log("start");
        aliceAddr = btcUtil.getAddressbyKeypair(alice);
        aliceH160 = btcUtil.addressToHash160(aliceAddr, 'pubkeyhash', btcNetworkName);
        console.log("aliceAddr: ", aliceAddr);
    });
    step('TC010: btcLock', async ()=>{
        const value = 200000;
        let record = await ccUtil.fund([alice], storemanH160, value);
        console.log("htcl lock record: ", record);

        await pu.sleep(2000);
        let btcTx = await ccUtil.getBtcTransaction(ccUtil.btcSender, record.txhash);
        assert(web3.toBigNumber(btcTx.vout[0].value).mul(100000000).toNumber(), value, "amount is wrong");
        lockBtcRecord = record;
    });
    step('TC011: sendWanNotice', async ()=>{
        let tx = {};
        tx.storeman = '0x'+storemanH160;
        tx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userH160 = '0x'+aliceH160;
        tx.hashx='0x'+lockBtcRecord.hashx;
        tx.txHash = '0x'+lockBtcRecord.txhash;
        tx.lockedTimestamp = lockBtcRecord.redeemLockTimeStamp;
        tx.gas = 1000000;
        tx.gasPrice = 200000000000; //200G;
        tx.passwd='wanglu';
        console.log("sendWanNotice tx: ",tx);
        let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        console.log("sendWanNotice txHash:", txHash);

        //wait storeman lock
        console.log("check storeman lock tx");
        let lastStatus = 'sentHashPending';
        while(1){
            let checkres = ccUtil.getBtcWanTxHistory({'HashX':lockBtcRecord.hashx})
            assert.equal(checkres.length, 1, "records not found");
            let record = checkres[0]
            if(lastStatus !== record.status){
                lastStatus = record.status
                console.log("new status: ", lastStatus)
            }
            if(record.status === 'waitingX'){
                break;
            }
            await pu.sleep(10000);
        }
        console.log("lockBtcTest done. x: ", lockBtcRecord.x);
    });
    step('TC012: redeemBtc', async ()=>{
        //(sender, from, gas, gasPrice, x, passwd, nonce)
        const gasLimit = 1000000;
        const gasPrice = 200000000000; //200G;
        let hashid = await ccUtil.sendDepositX(ccUtil.wanSender, "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd",
            gasLimit, gasPrice, '0x'+lockBtcRecord.x, "wanglu");
        console.log("redeem hashid: ", hashid);
        //wait until redeem success
        console.log("check redeem tx");
        let lastStatus = 'sentXPending';
        while(1){
            let checkres = ccUtil.getBtcWanTxHistory({'HashX':lockBtcRecord.hashx})
            assert.equal(checkres.length, 1, "records not found");
            let record = checkres[0]
            if(lastStatus !== record.status){
                lastStatus = record.status
                console.log("new status: ", lastStatus)
            }
            if(record.status === 'redeemFinished'){
                break;
            }
            await pu.sleep(10000);
        }
        console.log("redeemWithHashX done. ");
    });
    after('end', async ()=>{
        wanchainCore.close();
    });
});




describe('wbtc2btc test', ()=> {
    const wdValue = 200000;
    let wanHashX;
    before(async () => {
        config.wanchainHtlcAddr = "0xb248ed04e1f1bbb661b56f210e4b0399b2899d16";
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        console.log("start");
        aliceAddr = btcUtil.getAddressbyKeypair(alice);
        aliceH160 = btcUtil.addressToHash160(aliceAddr, 'pubkeyhash', btcNetworkName);
        console.log("aliceAddr: ", aliceAddr);
    });
    step('TC010: wbtcLock', async ()=>{
        console.log("wbtcLock");
        let smgs = await ccUtil.getBtcSmgList(ccUtil.btcSender);
        console.log("smgs: ", smgs);
        let smg = smgs[0];
        let wdTx = {};
        wdTx.storemanGroup = smg.wanAddress;
        wdTx.gas = '0x'+(1000000).toString(16);
        wdTx.gasPrice = '0x'+(200000000000).toString(16); //200G;
        wdTx.passwd='wanglu';
        wdTx.cross = '0x'+aliceH160;
        wdTx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        wdTx.amount = '0x'+wdValue.toString(16);//0.2
        const txFeeRatio = smg.txFeeRatio;
        wdTx.value = ccUtil.calculateLocWanFee(wdTx.amount,ccUtil.c2wRatio,  txFeeRatio);
        console.log("wdTx.value: ",wdTx.value);
        let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
        wdTx.x = x;
        console.log("wdTx:", wdTx);
        console.log("wdtx hashx:", hashx);
        let wdHash = await ccUtil.sendWanHash(ccUtil.wanSender, wdTx);
        console.log("wdHash: ",wdHash);

        //wait storeman lock
        console.log("check storeman lock tx");
        let lastStatus = 'sentHashPending';
        while(1){
            let checkres = ccUtil.getBtcWanTxHistory({'HashX':hashx})
            assert.equal(checkres.length, 1, "records not found");
            let record = checkres[0]
            if(lastStatus !== record.status){
                lastStatus = record.status
                console.log("new status: ", lastStatus)
            }
            if(record.status === 'waitingX'){
                break;
            }
            await pu.sleep(10000);
        }
        wanHashX = hashx;
    });

    step('TC012: redeemWithHashX', async ()=>{
        await pu.sleep(3000);
        let hashid = await ccUtil.redeemWithHashX(wanHashX, alice);
        console.log("redeem hashid: ", hashid);
        await pu.sleep(3000);
        let ctx = await ccUtil.getBtcTransaction(ccUtil.btcSender, hashid);
        console.log(ctx);
        //wait until redeem success
        console.log("check redeem tx");
        let lastStatus = 'sentXPending';
        while(1){
            let checkres = ccUtil.getBtcWanTxHistory({'HashX':wanHashX})
            assert.equal(checkres.length, 1, "records not found");
            let record = checkres[0]
            if(lastStatus !== record.status){
                lastStatus = record.status
                console.log("new status: ", lastStatus)
            }
            if(record.status === 'redeemFinished'){
                break;
            }
            await pu.sleep(10000);
        }
        console.log("redeemWithHashX done. ");
    });

    after('end', async ()=>{
        wanchainCore.close();
    });
});
