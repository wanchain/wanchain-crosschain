'use strict';


const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const WanchainCore = require('../walletCore.js');
const pu = require('promisefy-util');
const bitcoin  = require('bitcoinjs-lib');
const config = require('../config.js');
let wanchainCore;
let ccUtil;
let btcUtil;
const storemanHash160 = Buffer.from('d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'hex');
const storemanHash160Addr = "0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe";
const storemanWanAddr = "0xd0b327d711dbf1f6d5de93777cdee724a6577042";
const storemanWif = 'cQrhq6e1bWZ8YBqaPcg5Q8vwdhEwwq1RNsMmv2opPQ4fuW2u8HYn';
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, bitcoin.networks.testnet
);

describe('wan api test', ()=>{
    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        // let kps = btcUtil.getECPairs("xx");
        // let addr = btcUtil.getAddressbyKeypair(kps[0]);
        // console.log("##########addr:", addr);

        console.log("start");
    });
    it('TC001: wan filter check', async ()=>{
        let currentBlock = web3.eth.blockNumber;
        let filterValue = {
            fromBlock: 1000000,
            toBlock: currentBlock,
            address: config.wanchainHtlcAddr,
            topics: ["0xbc5d2ea574e7cf33bf89888310d2e83efc204c5741f027dc1e36e0c482f75504", null, null, "0xd629eb0d7a23530fabc8715bba8194b2f93d389d2efdd8c7af2a6d8707ba51d0"]
        };
        let filter = web3.eth.filter(filterValue);
        filter.get( function(error, result){
            if (!error)
                console.log(result);
        });
    });

    it('TC001: lockWbtcTest', async ()=>{
        console.log("lockWbtcTest");
        let btckp = bitcoin.ECPair.makeRandom({network:bitcoin.networks.testnet});
        let wdTx = {};
        wdTx.storemanGroup = storemanWanAddr;
        wdTx.gas = '1000000';
        wdTx.gasPrice = '200000000000'; //200G;
        wdTx.passwd='wanglu';
        wdTx.cross = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd"; // TODO: this should be btc hash160
        wdTx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        wdTx.amount = 0.000000000001;
        const txFeeRatio = 3;
        wdTx.value = ccUtil.calculateLocWanFee(wdTx.amount,ccUtil.c2wRatio,  txFeeRatio);
        //wdTx.value = 0x1770000;
        console.log("########## wdTx.value: ", wdTx.value);

        //newTrans.createTransaction(tx.from, config.wanchainHtlcAddr, tx.amount.toString(),tx.storemanGroup,tx.cross,tx.gas,this.toGweiString(tx.gasPrice.toString()),'WETH2ETH',tx.nonce);
        let wdHash = await ccUtil.sendWanHash(ccUtil.wanSender, wdTx);
        console.log("wdHash: ",wdHash);
        let currentBlock = web3.eth.blockNumber;
        let filterValue = {
            fromBlock: 1000000,
            toBlock: currentBlock,
            address: config.wanchainHtlcAddr,
            topics: ["0xbc5d2ea574e7cf33bf89888310d2e83efc204c5741f027dc1e36e0c482f75504", null, null, "0xd629eb0d7a23530fabc8715bba8194b2f93d389d2efdd8c7af2a6d8707ba51d0"]
        };
        let filter = web3.eth.filter(filterValue);
        let filterResult  = await pu.promisefy(filter.watch,[],filter);
        console.log(filterResult);
        filter.stopWatching();

    });

    after('end', async ()=>{
        wanchainCore.close();
    });

});