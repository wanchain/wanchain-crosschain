'use strict';


const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const WanchainCore = require('../walletCore.js');
const pu = require('promisefy-util');
const config = require('../config.js');
let wanchainCore;
let ccUtil;
let btcUtil;

describe('wan api test', ()=>{
    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        let kps = btcUtil.getECPairs("xx");
        let addr = btcUtil.getAddress(kps[0]);
        console.log("##########addr:", addr);

        console.log("start");
    });
    it('TC001: wan notice check', async ()=>{
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

    it('TC001: wan notice check', async ()=>{
        // const tx = {};
        // tx.storeman = '0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe';
        // tx.userWanAddr = '0xbd100cf8286136659a7d63a38a154e28dbf3e0fd';
        // tx.hashx='0x0011223344';
        // tx.txhash = '0x0011223344';
        // tx.lockedTimestamp = 1234567;
        // tx.gas = '1000000';
        // tx.gasPrice = '200000000000'; //200G;
        // tx.passwd='wanglu';
        // let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        // console.log(txHash);
        // await pu.sleep(20000);
        // console.log( await web3.eth.getTransactionReceipt(txHash));
    });

    after('end', async ()=>{
        wanchainCore.close();
    });

});