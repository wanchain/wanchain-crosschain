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

    it('TC000: btcLock', async ()=>{
        let record = await ccUtil.fund([alice], storemanH160, value);
        console.log("htcl lock record: ", record);

        await pu.sleep(2000);
        let btcTx = await ccUtil.getBtcTransaction(ccUtil.btcSender, record.txhash);
        assert(web3.toBigNumber(btcTx.vout[0].value).mul(100000000).toNumber(), value, "amount is wrong");
        lockBtcRecord = record;
    });
    it('TC001: sendWanNotice', async ()=>{
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
    it('TC002: redeemBtc', async ()=>{
        let hashid = await ccUtil.redeem(lockBtcRecord.x, lockBtcRecord.hashx, lockBtcRecord.LockedTimestamp, lockBtcRecord.senderH160Addr, storeman, lockBtcRecord.value,lockBtcRecord.txhash);
        console.log("redeem hashid: ", hashid);
        await pu.sleep(5000);
        let ctx = await ccUtil.getBtcTransaction(ccUtil.btcSender, hashid);
        console.log(ctx);
        assert(web3.toBigNumber(ctx.vout[0].value).mul(100000000).toNumber(), value-config.feeHard, "amount is wrong");
    });
    it.skip('TC003: onlineCheck', async ()=>{
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

    it('TC000: wbtcLock', async ()=>{
        const value = 200000;
        let record = await ccUtil.fund([alice], storemanH160, value);
        console.log("htcl lock record: ", record);
        let tx = {};
        tx.storeman = '0x'+storemanH160;
        tx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userH160 = '0x'+aliceH160;
        tx.hashx='0x'+record.hashx;
        tx.txHash = '0x'+record.txhash;
        tx.lockedTimestamp = record.LockedTimestamp;
        tx.gas = 1000000;
        tx.gasPrice = 200000000000; //200G;
        tx.passwd='wanglu';
        let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        console.log("sendWanNotice txHash:", txHash);

        await pu.sleep(2000);
        let btcTx = await ccUtil.getBtcTransaction(ccUtil.btcSender, record.txhash);
        assert(web3.toBigNumber(btcTx.vout[0].value).mul(100000000).toNumber(), value, "amount is wrong");
        lockBtcRecord = record;
    });
    it('TC001: sendWanNotice', async ()=>{
        let tx = {};
        tx.storeman = '0x'+storemanH160;
        tx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userH160 = '0x'+aliceH160;
        tx.hashx='0x'+record.hashx;
        tx.txHash = '0x'+record.txhash;
        tx.lockedTimestamp = record.LockedTimestamp;
        tx.gas = 1000000;
        tx.gasPrice = 200000000000; //200G;
        tx.passwd='wanglu';
        let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        console.log("sendWanNotice txHash:", txHash);
    });
    it('TC002: redeemWithHashX', async ()=>{
        let hashid = await ccUtil.redeemWithHashX(lockBtcRecord.hashx, storeman);
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
    it('TC003: redeemSriptCheck', async () => {
        let redeemScriptSigData = '473044022015c227f40f5dae2f8e40124eb6c2b0556c48d428208823d595803a522454ebd5022061bfb8fa71a00013d3d719d11f2b046a85162bc70c10d9831ee08aca5c3916f501210334de97350340e8537fdae10f92081f40378fe3d46346b0c753b2cb8f1169290a209d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5514c5c63a820eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e58876a9147ef9142e7d6f28dda806accb891e4054d6fa9eae670309c500b17576a914d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe6888ac'
        let res = ccUtil.redeemSriptCheck(redeemScriptSigData)
        assert.notEqual(res, undefined, 'redeemSriptCheck failed')
        assert.equal(res.HASHX.toString('hex'), 'eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5', 'redeemSriptCheck failed')
        assert.equal(res.LOCKTIME.toString('hex'), '09c500', 'redeemSriptCheck failed')
        assert.equal(res.DESTHASH160.toString('hex'), '7ef9142e7d6f28dda806accb891e4054d6fa9eae', 'redeemSriptCheck failed')
        assert.equal(res.REVOKERHASH160.toString('hex'), 'd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'redeemSriptCheck failed')
    })
    it.skip('TC004: onlineCheck', async ()=>{
    });
    after('end', async ()=>{
        wanchainCore.close();
    });
});

