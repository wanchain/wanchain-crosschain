'use strict';


const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://18.237.186.227:8545'));
const WanchainCore = require('../walletCore.js');
const pu = require('promisefy-util');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const client = new Client(config.btcServer.regtest);
let wanchainCore;
let ccUtil;
let btcUtil;
const value = 1;
const value2 = 2;
const secret = 'LgsQ5Y89f3IVkyGJ6UeRnEPT4Aum7Hvz';
const commitment = 'bf19f1b16bea379e6c3978920afabb506a6694179464355191d9a7f76ab79483';
const storemanHash160 = Buffer.from('d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'hex');
const storemanHash160Addr = "0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe";
const storemanWif = 'cQrhq6e1bWZ8YBqaPcg5Q8vwdhEwwq1RNsMmv2opPQ4fuW2u8HYn';
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, bitcoin.networks.testnet
);

const storemanWanAddr = "0xd0b327d711dbf1f6d5de93777cdee724a6577042";
var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
let aliceAddr;

const aliceHash160Addr = bitcoin.crypto.hash160(alice.publicKey).toString('hex');
let storemanAddr;

async function waitEventbyHashx(eventName,abi, hashx) {
    let eventHash = ccUtil.getEventHash(eventName, abi);
    console.log("eventHash: ", eventHash);
    let currentBlock = web3.eth.blockNumber;
    let filterValue = {
        fromBlock: 1000000,
        toBlock: currentBlock,
        address: config.wanchainHtlcAddr,
        topics: [eventHash, null, null, hashx]
    };
    console.log("topics:", filterValue.topics);
    let filter = web3.eth.filter(filterValue);
    while(1){
        let filterResult  = await pu.promisefy(filter.get,[],filter);
        console.log(filterResult);
        if(filterResult){
            break;
        }
        await pu.sleep(10000);
    }
}
describe('wan api test', ()=>{
    before(async () => {
        wanchainCore = new WanchainCore({});
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        aliceAddr = btcUtil.getAddressbyKeypair(alice);
        storemanAddr = btcUtil.getAddressbyKeypair(storeman);
        await wanchainCore.init();
        // let kps = btcUtil.getECPairs("xx");
        // let addr = btcUtil.getAddressbyKeypair(kps[0]);
        // console.log("##########addr:", addr);

        console.log("start");
    });

    // it('TC001: wan filter check', async ()=>{
    //     await waitEventbyHashx('BTC2WBTCRefund', config.HTLCWBTCInstAbi, '0x0xd629eb0d7a23530fabc8715bba8194b2f93d389d2efdd8c7af2a6d8707ba51d0');
    // });

    it('TC001: lockWbtcTest', async ()=>{
        console.log("lockWbtcTest");
        // let wdTx = {};
        // wdTx.storemanGroup = storemanWanAddr;
        // wdTx.gas = '1000000';
        // wdTx.gasPrice = '200000000000'; //200G;
        // wdTx.passwd='wanglu';
        // wdTx.cross = '0x'+aliceHash160Addr;
        // wdTx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        // wdTx.amount = 0.000000000001;
        // const txFeeRatio = 3;
        // wdTx.value = ccUtil.calculateLocWanFee(wdTx.amount,ccUtil.c2wRatio,  txFeeRatio);
        // //wdTx.value = 0x1770000;
        // console.log("########## wdTx.value: ", wdTx.value);
        //
        // //newTrans.createTransaction(tx.from, config.wanchainHtlcAddr, tx.amount.toString(),tx.storemanGroup,tx.cross,tx.gas,this.toGweiString(tx.gasPrice.toString()),'WETH2ETH',tx.nonce);
        // let wdHash = await ccUtil.sendWanHash(ccUtil.wanSender, wdTx);
        // console.log("wdHash: ",wdHash);

        //wait tx confirm
        //await waitEventbyHashx('WBTC2BTCLock', config.HTLCWBTCInstAbi, wdHash);

        // wait storeman lock notice.
        await client.sendToAddress(storemanAddr, 2);
        await client.generate(1);
        let withdrawValue = value;// TODO: how to get hte value.
        let record = await ccUtil.fund(storeman, aliceHash160Addr, withdrawValue);
        await client.generate(1);
        await client.generate(1);
        // stomen send notice.
        // wait confirm

        // wallet wait storeman event.
        //wallet send redeem.
        let walletRedeem = await ccUtil.redeem(record.x,record.hashx, record.redeemLockTimeStamp, storeman,alice, value, record.txHash, record);
        console.log(walletRedeem);

    });
    it('TC001: scanBlock', async ()=>{
        let bheight = await client.getBlockCount();
        let cur = bheight ; // wait 1 block;
        let bhash = await client.getBlockHash(cur);
        let block = await client.getBlock(bhash, 2); // include txs
        console.log(block);
    });
    it('TC001: lockBtcTest', async ()=>{
        await client.sendToAddress(aliceAddr, 2);
        await client.generate(1);

        let record = await ccUtil.fund(alice, storemanHash160Addr, value);

        // notice wan.
        const tx = {};
        tx.storeman = storemanHash160Addr;
        tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.hashx = '0x'+record.hashx;
        tx.txHash = '0x'+record.txHash;
        tx.lockedTimestamp = record.redeemblocknum;
        tx.gas = '1000000';
        tx.gasPrice = '200000000000'; //200G;
        tx.passwd='wanglu';
        console.log("######## tx.hashx: ", tx.hashx);
        let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        console.log("sendWanNotice txHash:", txHash);

        //wait storeman lock
        console.log("check storeman lock tx");
        while(1){
            let crossEvent = await ccUtil.getDepositCrossLockEvent(ccUtil.wanSender, tx.hashx);
            console.log(crossEvent);
            if(crossEvent.length == 0){
                console.log("wait...");
                await pu.sleep(10000);
            }
            else{
                break;
            }
        }

        // sendDepositX(sender, from,gas,gasPrice,x, passwd, nonce)
        console.log("x: ", record.x);
        let redeemHash = await ccUtil.sendDepositX(ccUtil.wanSender, tx.userWanAddr,tx.gas,tx.gasPrice,'0x'+record.x, tx.passwd);
        console.log("redeemHash: ", redeemHash);

        // filteer watch.
        await waitEventbyHashx('BTC2WBTCRefund', config.HTLCWBTCInstAbi, '0x'+record.hashx);

    });
    after('end', async ()=>{
        wanchainCore.close();
    });

});