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
const value   = 10000000;
const wdValue = 2000000;
const storemanHash160Addr = "0x9022c407879beee21132fc89008d983423198873";
const storemanHash160 = Buffer.from(storemanHash160Addr, 'hex');
const storemanWif = 'cUFo4w9Z94onimW9rLEDMzMJYY9V24AX28DkhA2goDNJ2bAJJKX2';
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, bitcoin.networks.testnet
);
const storemanWanAddr = "0xd0b327d711dbf1f6d5de93777cdee724a6577042";
var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";

const aliceHash160Addr = bitcoin.crypto.hash160(alice.publicKey).toString('hex');
console.log("aliceHash160Addr:", aliceHash160Addr);
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
describe('wan api test', ()=>{
    before(async () => {
        wanchainCore = new WanchainCore({});
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init();
        client = ccUtil.client;
        // let kps = btcUtil.getECPairs("xx");
        // let addr = btcUtil.getAddressbyKeypair(kps[0]);
        // console.log("##########addr:", addr);
        console.log("storeman btc addr:", btcUtil.getAddressbyKeypair(storeman));
        console.log("alice btc addr:", btcUtil.getAddressbyKeypair(alice));
        console.log("aliceHash160Addr: ", aliceHash160Addr);

        console.log("start");
    });

    // it('TC001: wan filter check', async ()=>{
    //     await waitEventbyHashx('BTC2WBTCRefund', config.HTLCWBTCInstAbi, '0x0xd629eb0d7a23530fabc8715bba8194b2f93d389d2efdd8c7af2a6d8707ba51d0');
    // });
	it('TC001: redeemTestWbtc', async (	)=>{
		// wait storeman lock notice.
		// await client.sendToAddress(storemanAddr, 2);
		// await client.generate(1);
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
		// wait storeman lock notice.
		// await client.sendToAddress(storemanAddr, 2);
		// await client.generate(1);
		let record = await ccUtil.fund([alice], storemanHash160Addr, wdValue);
		console.log("record.redeemScript:",record.redeemScript);
		await client.generate(10);
		let walletRedeem = await ccUtil.redeem(record.x,record.hashx, record.redeemLockTimeStamp, aliceHash160Addr,storeman, wdValue, record.txhash);
		console.log(walletRedeem);

    let checkres = ccUtil.getBtcWanTxHistory({'HashX':record.hashx})
    console.log(checkres);

		let rawTx = await client.getRawTransaction(walletRedeem);
		let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
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

    it('TC001: lockWbtcTest', async ()=>{
        console.log("lockWbtcTest");
        let wdTx = {};
        wdTx.storemanGroup = storemanWanAddr;
        wdTx.gas = '0x'+(1000000).toString(16);
        wdTx.gasPrice = '0x'+(200000000000).toString(16); //200G;
        wdTx.passwd='wanglu';
        wdTx.cross = '0x'+aliceHash160Addr;
        wdTx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        wdTx.amount = '0x'+wdValue.toString(16);//0.2
        const txFeeRatio = 10;
        wdTx.value = ccUtil.calculateLocWanFee(wdTx.amount,ccUtil.c2wRatio,  txFeeRatio);
        console.log("wdTx.value: ",wdTx.value);
        let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
        wdTx.x = x;
        console.log("wdTx:", wdTx);
        console.log("wdtx hashx:", hashx);
        let wdHash = await ccUtil.sendWanHash(ccUtil.wanSender, wdTx);
        console.log("wdHash: ",wdHash);

        // wait wallet tx confirm
        await waitEventbyHashx('WBTC2BTCLock', config.HTLCWBTCInstAbi, '0x'+hashx);






/*
        // // wait storeman lock notice.
        // // await client.sendToAddress(storemanAddr, 2);
        // // await client.generate(1);
        // let withdrawValue = wdValue;// TODO: how to get hte value.
        // let record = await ccUtil.Storemanfund(storeman, aliceHash160Addr, wdValue, hashx);
        // await client.generate(1);
        // await client.generate(1);
        // stomen send notice.
	    const tx = {};
	    tx.storeman = storemanHash160Addr;
	    tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
	    tx.hashx = '0x'+record.hashx;
	    tx.txHash = '0x'+record.txHash;
	    tx.lockedTimestamp = record.redeemLockTimeStamp;
	    tx.gas = ('1000000').toString(16);
	    tx.gasPrice = ('200000000000').toString(16); //200G;
	    tx.passwd='wanglu';
	    console.log("######## tx: ", tx);
	    let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
	    console.log("sendWanNotice txHash:", txHash);
*/


        //wallet wait storeman event.
        let filterResult = await waitEventbyHashx('WBTC2BTCLockNotice', config.HTLCWBTCInstAbi, '0x'+hashx);
        console.log("filterResult:", filterResult);
		let info = {}; // storeman info
	    let redeemLockTimeStamp = Number('0x'+filterResult[0].data.slice(66));
	    let txid = filterResult[0].data.slice(2,66);
	    console.log("redeemLockTimeStamp: ", redeemLockTimeStamp);
	    console.log("txid: ", txid);
        // let walletRedeem = await ccUtil.redeem(x,hashx, redeemLockTimeStamp, storemanHash160Addr,alice, wdValue, txid);
        // console.log(walletRedeem);
        // let rawTx = await client.getRawTransaction(walletRedeem);
        // let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
        // console.log("lockWbtcTest redeem:",ctx);

    });
    it('TC001: scanBlock', async ()=>{
        let bheight = await client.getBlockCount();
        let cur = bheight ; // wait 1 block;
        let bhash = await client.getBlockHash(cur);
        let block = await client.getBlock(bhash, 2); // include txs
        console.log(block);
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

    it('TC001: lockBtcTest', async ()=>{
        //await client.sendToAddress(aliceAddr, 2);
        //await client.generate(1);

        let record;
        try{
            record = await ccUtil.fund([alice], storemanHash160Addr, value);
        }catch(err){
            assert.equal(err.toString(), "");
            return;
        }

        let checkres = ccUtil.getBtcWanTxHistory({'HashX':record.hashx})
        console.log(checkres);

        // notice wan.
        const tx = {};
        tx.storeman = storemanHash160Addr;
        tx.from = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.userH160 = '0x'+bitcoin.crypto.hash160(alice.publicKey).toString('hex');
        tx.hashx = '0x'+record.hashx;
        tx.txHash = '0x'+record.txhash;
        tx.lockedTimestamp = record.redeemLockTimeStamp;
        tx.gas = ('1000000').toString(16);
        tx.gasPrice = ('200000000000').toString(16); //200G;
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
        // let redeemHash = await ccUtil.sendDepositX(ccUtil.wanSender, tx.from,tx.gas,tx.gasPrice,'0x'+record.x, tx.passwd);
        // console.log("redeemHash: ", redeemHash);

        // // filteer watch.
        // await waitEventbyHashx('BTC2WBTCRefund', config.HTLCWBTCInstAbi, '0x'+record.hashx);

    });
    after('end', async ()=>{
        wanchainCore.close();
    });

  it('TC001: hash160ToAddress', async ()=> {

    let userH160 = bitcoin.crypto.hash160(alice.publicKey).toString('hex');

    let addr = btcUtil.hash160ToAddress(userH160,'pubkeyhash','testnet');

    console.log("the address from hash160 =" + addr);

    let expectedAddr = btcUtil.getAddressbyKeypair(alice)
    assert.equal(addr,expectedAddr,"the address not match")
  });
  it('mytest', async ()=>{
      const storemanWif = 'cUFo4w9Z94onimW9rLEDMzMJYY9V24AX28DkhA2goDNJ2bAJJKX2';
      var storemanPair = bitcoin.ECPair.fromWIF(
          storemanWif, bitcoin.networks.testnet
      );
      let H160 = bitcoin.crypto.hash160(storemanPair.publicKey).toString('hex');
      let addr = btcUtil.hash160ToAddress(H160,'pubkeyhash','testnet');
      console.log("H160 is " + H160);
      console.log("addr is " + addr);

  })

  it('TC001: address2hash160', async ()=> {

    let addr = btcUtil.getAddressbyKeypair(alice)
    let hash160 = btcUtil.addressToHash160(addr,'pubkeyhash','testnet');

    console.log("the hash160 from address =" + hash160)
    let expectedH160 = bitcoin.crypto.hash160(alice.publicKey).toString('hex');

    console.log("the expected hash160 from address =" + expectedH160.toString('hex'))

    assert.equal(hash160,expectedH160,"the address not match")
  });


});
