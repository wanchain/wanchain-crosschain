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
        wdTx.storemanGroup = storemanHash160Addr;
        wdTx.gas = '1000000';
        wdTx.gasPrice = '200000000000'; //200G;
        wdTx.passwd='wanglu';
        wdTx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        wdTx.amount = 1;
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

    it('TC001: lockBtcTest', async ()=>{
        let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [aliceAddr]);
        console.log("utxos: ", utxos);

        let utxo = btcUtil.selectUtxoTest(utxos, value2);
        if(!utxo){
            console.log("############## no utxo");
            return;
        }
        //console.log("utxo: ", utxo);

        // generate script and p2sh address
        let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);
        const lockTime = 1000;
        let redeemLockTimeStamp = blocknum + lockTime;
        let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
        console.log("############### x:",x);
        console.log("############### hashx:",hashx);

        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, storemanHash160,aliceHash160Addr);
        contract.x = x;

        const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        txb.setVersion(1);
        txb.addInput(utxo.txid, utxo.vout);
        txb.addOutput(contract['p2sh'], value*100000000); // fee is 1
        txb.sign(0, alice);

        const rawTx = txb.build().toHex();
        console.log("rawTx: ", rawTx);

        let btcHash = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
        console.log("btc result hash:", btcHash);

        // notice wan.
        const tx = {};
        tx.storeman = storemanHash160Addr;
        tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.hashx = '0x'+lastContract.hashx;
        tx.txhash = btcHash;
        tx.lockedTimestamp = lastContract.redeemblocknum;
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
        console.log("x: ", lastContract.x);
        let redeemHash = await ccUtil.sendDepositX(ccUtil.wanSender, tx.userWanAddr,tx.gas,tx.gasPrice,'0x'+lastContract.x, tx.passwd);
        console.log("redeemHash: ", redeemHash);

        // filteer watch.
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