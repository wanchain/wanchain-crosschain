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
const storemanHash160Addr = "0x90bcfe35d8cdc5d0ebfe2748b7296c182911d923";
const storemanWif = 'cUFo4w9Z94onimW9rLEDMzMJYY9V24AX28DkhA2goDNJ2bAJJKX2';
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, bitcoin.networks.testnet
);
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
async function nredeem(redeemScript, txid, x, receiverKp, value) {
    var txb = new bitcoin.TransactionBuilder(config.bitcoinNetwork);
    txb.setVersion(1);
    txb.addInput(txid, 0);
    txb.addOutput(btcUtil.getAddressbyKeypair(receiverKp), (value - config.feeHard));

    const tx = txb.buildIncomplete();
    const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

    const redeemScriptSig = bitcoin.payments.p2sh({
        redeem: {
            input: bitcoin.script.compile([
                bitcoin.script.signature.encode(receiverKp.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                receiverKp.publicKey,
                Buffer.from(x, 'hex'),
                bitcoin.opcodes.OP_TRUE
            ]),
            output: redeemScript,
        },
        network: config.bitcoinNetwork
    }).input;
    tx.setInputScript(0, redeemScriptSig);

    let btcHash= await ccUtil.btcSendRawTransaction(tx.toHex());
    console.log("_redeem tx id:" + btcHash);
    return btcHash;
}
describe('wan api test', ()=>{
    before(async () => {
        wanchainCore = new WanchainCore({});
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        //await wanchainCore.init();
        await wanchainCore.storemanInit();
        client = ccUtil.client;
        // let kps = btcUtil.getECPairs("xx");
        // let addr = btcUtil.getAddressbyKeypair(kps[0]);
        // console.log("##########addr:", addr);
        console.log("storeman btc addr:", btcUtil.getAddressbyKeypair(storeman));
        console.log("alice btc addr:", btcUtil.getAddressbyKeypair(alice));
        console.log("aliceHash160Addr: ", aliceHash160Addr);

        console.log("start");
    });

    it('TC001: mytest', async ()=>{
        let txid = "bc0117210922e1ba705a6b1b803b43a445941b5dd3f725dcabbed4d037a965df";
        let vout = 0;
        let preoutscript = Buffer.from("76a9147ef9142e7d6f28dda806accb891e4054d6fa9eae88ac",'hex');
        let txb = new bitcoin.TransactionBuilder(config.bitcoinNetwork);
        txb.setVersion(1);
        txb.addInput(txid, vout, undefined,);
        txb.addOutput(aliceBtcAddr, value - config.feeHard);
        const tx = txb.buildIncomplete();
        const sigHash = tx.hashForSignature(0, preoutscript, bitcoin.Transaction.SIGHASH_ALL);
        let hashsig = alice.sign(sigHash);
        let ScriptSig = bitcoin.payments.p2pkh({
            signature:bitcoin.script.signature.encode(hashsig, bitcoin.Transaction.SIGHASH_ALL),
            pubkey: alice.publicKey,
            network: config.bitcoinNetwork
        }).input;


        tx.setInputScript(0, ScriptSig);
        let btcHash= await ccUtil.btcSendRawTransaction(tx.toHex());
        console.log("mytest tx id:" + btcHash);
        return btcHash;
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
        //wanchainCore.close();
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

  });
    it('TC001: storemanH1602addr', async ()=> {

        let userH160 = "83C96ffdCE7A2206421A4C33B2CF2030CE53e772";

        let addr = btcUtil.hash160ToAddress(userH160,'pubkeyhash','mainnet');

        console.log("the address from hash160 = " + addr);

    });
    it('mpc1', async ()=>{
        config.isStoreman = true;
        config.isMpc = true;
        let target = {
            address: aliceBtcAddr,
            value: value
        };
        let utxos = await ccUtil.clientGetBtcUtxo(config.MIN_CONFIRM_BLKS, config.MAX_CONFIRM_BLKS,[config.storemanBtcAddr]);
        console.log("utxos:", utxos);
        let result = await ccUtil.btcBuildTransactionMpc(utxos, target, config.feeRate);
        console.log("result:", result);
        let ctx = await ccUtil.client.decodeRawTransaction(result.rawTx);
        console.log("ctx:", ctx);
        let txhash = await ccUtil.client.sendRawTransaction(result.rawTx);
        console.log("txhash:", txhash);
    });

  it('TC001: address2hash160', async ()=> {

    let addr = btcUtil.getAddressbyKeypair(alice);
    let hash160 = btcUtil.addressToHash160(addr,'pubkeyhash','testnet');

    console.log("the hash160 from address =" + hash160)
    let expectedH160 = bitcoin.crypto.hash160(alice.publicKey).toString('hex');

    console.log("the expected hash160 from address =" + expectedH160.toString('hex'))

    assert.equal(hash160,expectedH160,"the address not match")
    
    // test addr to h160
    let addr2 = "mnAqWSmymTpJRcsPmN5uTDA2uFxPZTX29j";
    let hash1602 = btcUtil.addressToHash160(addr2,'pubkeyhash','testnet');
	console.log("hash1602: ",hash1602);
  });

    it('TC031: redeemSriptCheck', async ()=> {

        let rawTx = "010000000146d1c29fda08598536aba9620632d9707a3da2f5c1e65abd9c6fbfa4c57f8c2300000000eb473044022075125fbd3518eee4d9eef710571304c0c56c6870c6cf81988e4e5e48e81bab4d02206a4d4858e70a4f73ac0fb0166466e4aeba7f0e4359331b4d110efd062292ed850121027342e5e9e09ea43b0ba299ca876e1079d85eb13183e273f8370aca199da7818d20fa455ed58d6bd4d113568163f690386450a35b4a2ef1ae102d1ec1b0af4f70ea514c5d63a820d0355f64e97f9346c10d47ffde69572d3599168f902bacfed18252542b7c28e68876a9149fbe5cfb59c0d678f56d172379f0bcdbcd6ef1b26704ef2fd95bb17576a91483c96ffdce7a2206421a4c33b2cf2030ce53e7726888acffffffff0130e60200000000001976a9149fbe5cfb59c0d678f56d172379f0bcdbcd6ef1b288ac00000000";
        let ctx = bitcoin.Transaction.fromHex(rawTx);
        let result = ccUtil.redeemSriptCheck(ctx.ins[0].script.toString('hex'));
        if( !(result instanceof Error)) {
            // only handle REVOKERHASH160 is storeman
            const stmRipemd160Addr = ("83C96ffdCE7A2206421A4C33B2CF2030CE53e772").toLowerCase();
            console.log("result.REVOKERHASH160: ", result.REVOKERHASH160,"stmRipemd160Addr", stmRipemd160Addr);
            assert.equal(result.REVOKERHASH160 , stmRipemd160Addr, "stmRipemd160Addr is wrong")
        }
    });
});
