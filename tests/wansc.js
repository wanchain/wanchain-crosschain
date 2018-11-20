'use strict';


const Web3 = require("web3");
const assert = require('chai').assert;
var web3 = new Web3(new Web3.providers.HttpProvider('http://18.237.186.227:8545'));
const WanchainCore = require('../walletCore.js');
const pu = require('promisefy-util');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
let client;

let wanchainCore;
let ccUtil;
let btcUtil;
const value   = 300000;
const wdValue = 200000;
const storemanHash160Addr = "83e5ca256c9ffd0ae019f98e4371e67ef5026d2d";
const storemanBtcAddr = "msYN6FJfvA3p2XoVzgjZpZV4AbEcwBQEEJ";
const storemanWanAddr = "0x130407476fff4616d01f6eadd90845dc8a65e23a";
var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";

const aliceHash160Addr = "7ef9142e7d6f28dda806accb891e4054d6fa9eae";
const aliceBtcAddr = "ms6KpXRvUwwygwzgRoANRwgcGskXcnEwAr";
console.log("aliceHash160Addr:", aliceHash160Addr); // 7ef9142e7d6f28dda806accb891e4054d6fa9eae
console.log("alice btc addr: ms6KpXRvUwwygwzgRoANRwgcGskXcnEwAr");

async function waitEventbyHashx(eventName,abi, hashx) {
    let eventHash = ccUtil.getEventHash(eventName, abi);
    console.log("eventHash: ", eventHash);
    while(1){
        let currentBlock = web3.eth.blockNumber;
        let filterValue = {
            fromBlock: 1000000,
            toBlock: currentBlock,
            address: config.wanchainHtlcAddr,
            topics: [eventHash, null, null, hashx]
        };
        console.log("topics:", filterValue.topics);
        let filter = web3.eth.filter(filterValue);
        let filterResult  = await pu.promisefy(filter.get,[],filter);
        console.log("filterResult: ", filterResult);
        if(filterResult.length != 0){
	        return filterResult;
        }
        await pu.sleep(10000);
    }

}

describe.skip('wan api test', ()=>{
    before(async () => {
        wanchainCore = new WanchainCore({});
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init();
        console.log("storeman btc addr:", storemanBtcAddr);
        console.log("alice btc addr:", btcUtil.getAddressbyKeypair(alice));
        console.log("aliceHash160Addr: ", aliceHash160Addr);
        console.log("start");
    });
	it('TC001: redeemTestWbtc', async (	)=>{
		// wait storeman lock notice.
		// await client.sendToAddress(storemanAddr, 2);
		// await client.generate(1);
        config.isStoreman = true;
        config.isMpc = false;
		let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
		let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
		let record = await ccUtil.Storemanfund(storeman, aliceHash160Addr, wdValue, hashx);
		console.log("record.redeemScript:",record.redeemScript);
		await client.generate(1);
		await client.generate(1);
		let walletRedeem = await ccUtil.redeem(x,hashx, record.redeemLockTimeStamp, storemanHash160Addr,alice, wdValue, record.txhash);
		console.log(walletRedeem);

        let checkres = ccUtil.getBtcWanTxHistory({'HashX':record.hashx})
        console.log(checkres);

        let rawTx = await client.getRawTransaction(walletRedeem);
		let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
		console.log("lockWbtcTest redeem:",ctx);
	});
	it('TC001: redeemTestBtc', async (	)=>{
	    config.isStoreman = true;
	    config.isMpc = true;
        let x = ccUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
		let record = await ccUtil.StoremanfundMpc(config.stmRipemd160Addr, wdValue, hashx);
        record.x = x;
		console.log("record:", record);
        let v = await ccUtil._verifyBtcUtxo(config.stmRipemd160Addr,record.txhash, record.hashx,record.LockedTimestamp, config.stmRipemd160Addr); //(storemanAddr, txHash, hashx, lockedTimestamp)
		console.log("record.redeemScript:",record.redeemScript);
		await client.generate(1);
        config.isMpc = true;
		let walletRedeem = await ccUtil.redeemMpc(record.x, record.hashx, record.redeemScript,  config.stmRipemd160Addr, wdValue,record.txhash);
		console.log(walletRedeem);
        let checkres = ccUtil.getBtcWanTxHistory({'HashX':record.hashx})
        console.log(checkres);

		let ctx = await client.getRawTransaction(walletRedeem, true);
		//let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
		console.log("lockWbtcTest redeem:",ctx);
	});
    it('TC001: revokeTestBtc', async (	)=>{
        // wait storeman lock notice.
        // await client.sendToAddress(storemanAddr, 2);
        // await client.generate(1);
        let lockTimeBak = ccUtil.config.lockTime;
        ccUtil.config.lockTime = 10;
        let record = await ccUtil.fund([alice], storemanHash160Addr, wdValue);
        console.log(record)
        console.log("record.redeemScript:",record.redeemScript);

        await client.generate(20);

        //let walletRevoke = await ccUtil.revoke(record.hashx, record.redeemLockTimeStamp, storemanHash160Addr,alice, wdValue, record.txhash);

        let walletRevoke = await ccUtil.revokeWithHashX(record.hashx,alice);

        console.log(walletRevoke);
        ccUtil.config.lockTime = lockTimeBak;
        let rawTx = await client.getRawTransaction(walletRevoke);
        let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
        console.log("lockWbtcTest redeem:",ctx);
    });

    it('TC001: revokeTestWbtc', async (	)=>{
        // wait storeman lock notice.
        // await client.sendToAddress(storemanAddr, 2);
        // await client.generate(1);
        let lockTimeBak = ccUtil.config.lockTime;
        ccUtil.config.lockTime = 10;
        let x = ccUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
        let record = await ccUtil.Storemanfund(storeman, aliceHash160Addr, wdValue, hashx);
        console.log("record.redeemScript:",record.redeemScript);
        await client.generate(20);

       // let walletRevoke = await ccUtil.revoke(hashx, record.redeemLockTimeStamp, aliceHash160Addr,storeman, wdValue, record.txhash);
        let walletRevoke = await ccUtil.revokeWithHashX(hashx,storeman);

        console.log(walletRevoke);
        ccUtil.config.lockTime = lockTimeBak;
        let rawTx = await client.getRawTransaction(walletRevoke);
        let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
        console.log("lockWbtcTest redeem:",ctx);
    });


    it('TC001: Storemanfund', async ()=>{
        //Storemanfund(senderKp, ReceiverHash160Addr, value, hashx )
        let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
        let tx = await ccUtil.Storemanfund(storeman, aliceHash160Addr, value, hashx );
        let checkres = ccUtil.getBtcWanTxHistory({'HashX':tx.hashx})
        console.log(checkres);

        let rawTx = await client.getRawTransaction(tx.txhash);
        let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
        console.log("Storemanfund:",ctx);
    });


    after('end', async ()=>{
        //wanchainCore.close();
    });
});
