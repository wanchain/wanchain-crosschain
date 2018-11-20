// this code is equal to https://github.com/wanchain/crossBtc/blob/master/docs/python-poc/simple_btc_htlc.py
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
let storemanAddr;
let storemanH160;


const print4debug = console.log;

async function findOneTxToAddress(dest){
    const txs = await client.listUnspent(0,  1000000, [dest]);
    // print4debug('find dest: ' + dest);
    for(i = 0; i < txs.length; i++){
        let tx = txs[i];
        if(dest === tx['address']){
            print4debug(JSON.stringify(tx, null, 4));
            return tx
        }
    }
    return null
}

function selectUtxo(utxos, value) {
    let utxo;
    for(let i=0; i<utxos.length; i++){
        if(utxos[i].amount >= value){
            utxo = utxos[i];
            console.log("find utxo:", utxo);
            return utxo;
        }
    }
    console.log("can't find");
    return null;
}



//
// async function hashtimelockcontract(storemanHash160,xHash, redeemblocknum){
//     let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);
//
//     print4debug("blocknum:" + blocknum);
//     print4debug("Current blocknum on Bitcoin: " + blocknum);
//     let redeemblocknum = blocknum + locktime;
//     print4debug("Redeemblocknum on Bitcoin: " + redeemblocknum);
//
//     let redeemScript = bitcoin.script.compile([
//         /* MAIN IF BRANCH */
//         bitcoin.opcodes.OP_IF,
//         bitcoin.opcodes.OP_SHA256,
//         Buffer.from(xHash, 'hex'),
//         bitcoin.opcodes.OP_EQUALVERIFY,
//         bitcoin.opcodes.OP_DUP,
//         bitcoin.opcodes.OP_HASH160,
//
//         storemanHash160,// wallet don't know storeman pubkey. //bitcoin.crypto.hash160(storeman.publicKey),//storeman.getPublicKeyBuffer(),// redeemer address
//         //bitcoin.crypto.hash160(storeman.publicKey),
//         bitcoin.opcodes.OP_ELSE,
//         bitcoin.script.number.encode(redeemblocknum),
//         bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
//         bitcoin.opcodes.OP_DROP,
//         bitcoin.opcodes.OP_DUP,
//         bitcoin.opcodes.OP_HASH160,
//
//         bitcoin.crypto.hash160(alice.publicKey),//alice.getPublicKeyBuffer(), // funder addr
//         /* ALMOST THE END. */
//         bitcoin.opcodes.OP_ENDIF,
//
//         // Complete the signature check.
//         bitcoin.opcodes.OP_EQUALVERIFY,
//         bitcoin.opcodes.OP_CHECKSIG
//     ]);
//     print4debug(redeemScript.toString('hex'));
//     //var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
//     //var address = bitcoin.address.fromOutputScript(scriptPubKey, network)
//
//     let addressPay = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: network }, network: network });
//     let address = addressPay.address;
//
//     await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 100, [address]);
//
//     return {
//         'p2sh': address,
//         'redeemblocknum' : redeemblocknum,
//         'redeemScript': redeemScript,
//         'locktime': locktime
//     }
//
// }
// for test information.
// let lastContract;
// let lastTxid;
// const value = 1;
// const value2 = 2;
// async function fundHtlc(){
//     let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [aliceAddr]);
//     console.log("utxos: ", utxos);

//     let utxo = selectUtxo(utxos, value2);
//     assert.equal(value2, utxo.amount, "getBtcUtxo is wrong");
//     console.log("utxo: ", utxo);

//     // generate script and p2sh address
//     let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);
//     const lockTime = 1000;
//     let redeemLockTimeStamp = blocknum + lockTime;
//     let contract = await btcUtil.hashtimelockcontract(storemanHash160,  redeemLockTimeStamp);
//     lastContract = contract;
//     const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
//     txb.setVersion(1);
//     txb.addInput(utxo.txid, utxo.vout);
//     txb.addOutput(contract['p2sh'], value*100000000); // fee is 1
//     txb.sign(0, alice);

//     const rawTx = txb.build().toHex();
//     console.log("rawTx: ", rawTx);

//     let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
//     console.log("result hash:", result);
//     return result;
// }


// implicit redeem by storeman
async function redeem(contract, fundtx, secret){
    const redeemScript = contract['redeemScript'];

    var txb = new bitcoin.TransactionBuilder(network);
    txb.setVersion(1);
    print4debug('----W----A----N----C----H----A----I----N----');
    print4debug(JSON.stringify(fundtx))
    print4debug('----W----A----N----C----H----A----I----N----');
    txb.addInput(fundtx.txid, fundtx.vout);
    txb.addOutput(getAddress(storeman), 99900000);

    const tx = txb.buildIncomplete()
    const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

    const redeemScriptSig = bitcoin.payments.p2sh({
        redeem: {
            input: bitcoin.script.compile([
                bitcoin.script.signature.encode(storeman.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                storeman.publicKey,
                Buffer.from(secret, 'utf-8'),
                bitcoin.opcodes.OP_TRUE
            ]),
            output: redeemScript,
        },
        network: bitcoin.networks.testnet
    }).input
    tx.setInputScript(0, redeemScriptSig);
    console.log("===redeemScriptSig: ", bitcoin.script.toASM(redeemScriptSig));
    console.log("redeem tx: ", tx);
    print4debug("redeem raw tx: \n" + tx.toHex());
    const txid = await client.sendRawTransaction(tx.toHex(),
        function(err){print4debug(err);}
    );
    print4debug("redeem tx id:" + txid);
    return txid;
}


async function refund(contract, fundtx){
    const person = alice;// can change person to storeman will failed
    const redeemScript = contract['redeemScript'];

    var txb = new bitcoin.TransactionBuilder(network);
    txb.setLockTime(contract['redeemblocknum']);
    txb.setVersion(1);
    txb.addInput(fundtx.txid, fundtx.vout, 0);
    txb.addOutput(getAddress(person), (fundtx.amount-FEE)*100000000);

    const tx = txb.buildIncomplete();
    const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

    const redeemScriptSig = bitcoin.payments.p2sh({
        redeem: {
            input: bitcoin.script.compile([
                bitcoin.script.signature.encode(person.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                person.publicKey,
                bitcoin.opcodes.OP_FALSE
            ]),
            output: redeemScript
        }
    }).input;

    tx.setInputScript(0, redeemScriptSig);
    print4debug("refund raw tx: \n" + tx.toHex());

    await client.sendRawTransaction(tx.toHex(),
        function(err){print4debug(err);}
    );
}

async function testRefund(){
    contract = await hashtimelockcontract(commitment, 10);

    await fundHtlc();
    const fundtx = await findOneTxToAddress(contract['p2sh']);
    print4debug("fundtx:" + JSON.stringify(fundtx, null, 4));

    await client.generate(66);
    await refund(contract, fundtx);
}



async function showBalance(info){
    const aliceBalance = await client.getReceivedByAddress(getAddress(alice), 0);
    const storemanBalance = await client.getReceivedByAddress(getAddress(storeman), 0);
    console.log(info + " alice Balance: " + aliceBalance);
    console.log(info + " storeman   Balance: " + storemanBalance);
}





describe('btc2wbtc test', ()=> {
    const value = 200000;
    let lockBtcRecord={
        x: 'c1ac35598a2f10f46bc47828a561ed2bdb915dce66a17e888690aacf7ab8b481',
        hashx: '450f16867c2c4673c9db1e98fbe255a251dc301269c8650547bb0fbdbe03a6db',
        LockedTimestamp: 1541592184,
        value: 200000,
        txhash: '87c99d8cf01436d8760fa5ebbefb29de52abf08aa6c6afb974e948671d809547',
        senderH160Addr: '7ef9142e7d6f28dda806accb891e4054d6fa9eae',
    };

    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        console.log("start");
        aliceAddr = btcUtil.getAddressbyKeypair(alice);
        aliceH160 = btcUtil.addressToHash160(aliceAddr, 'pubkeyhash', btcNetworkName);
        storemanAddr = btcUtil.getAddressbyKeypair(storeman);
        storemanH160 = btcUtil.addressToHash160(storemanAddr, 'pubkeyhash', btcNetworkName);
        console.log("aliceAddr: ", aliceAddr);
        console.log("storemanAddr: ", storemanAddr);
    });

    it('TC000: btcLock', async ()=>{
        let record = await ccUtil.fund([alice], storemanH160, value);
        console.log("htcl lock record: ", record);
        await pu.sleep(5000);
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
        tx.lockedTimestamp = lockBtcRecord.LockedTimestamp;
        tx.gas = 1000000;
        tx.gasPrice = 200000000000; //200G;
        tx.passwd='wanglu';
        let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        console.log("sendWanNotice txHash:", txHash);
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


describe.only('wbtc2btc test', ()=> {
    let lockBtcRecord={
        hashx: '450f16867c2c4673c9db1e98fbe255a251dc301269c8650547bb0fbdbe03a6db'
    };
    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        console.log("start");
        aliceAddr = btcUtil.getAddressbyKeypair(alice);
        aliceH160 = btcUtil.addressToHash160(aliceAddr, 'pubkeyhash', btcNetworkName);
        storemanAddr = btcUtil.getAddressbyKeypair(storeman);
        storemanH160 = btcUtil.addressToHash160(storemanAddr, 'pubkeyhash', btcNetworkName);
        console.log("aliceAddr: ", aliceAddr);
        console.log("storemanAddr: ", storemanAddr);
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
        let rawTx = await ccUtil.getTxInfo(ccUtil.btcSender, hashid);
        console.log("rawTx:", rawTx);
        let btx = Buffer.from(rawTx,'hex');
        console.log("btx:", btx);
        let ctx = bitcoin.Transaction.fromHex(btx,bitcoin.networks.testnet);
        console.log(ctx);
        let ins = ctx.ins;
        for(let i=0; i<ins.length; i++) {
            let inItem = ins[i];
            let inScAsm = bitcoin.script.toASM(inItem.script);
            let inScHex = inItem.script.toString('hex');
            console.log("inScAsm", inScAsm);
            console.log("inScHex", inScHex);
        }
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


describe('crossUtil test', ()=> {
    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        console.log("start");
        aliceAddr = btcUtil.getAddressbyKeypair(alice);
        aliceH160 = btcUtil.addressToHash160(aliceAddr, 'pubkeyhash', btcNetworkName);
        storemanAddr = btcUtil.getAddressbyKeypair(storeman);
        storemanH160 = btcUtil.addressToHash160(storemanAddr, 'pubkeyhash', btcNetworkName);
        console.log("aliceAddr: ", aliceAddr);
        console.log("storemanAddr: ", storemanAddr);
    });
    it('TC001: redeemSriptCheck', async () => {
        let redeemScriptSigData = '473044022015c227f40f5dae2f8e40124eb6c2b0556c48d428208823d595803a522454ebd5022061bfb8fa71a00013d3d719d11f2b046a85162bc70c10d9831ee08aca5c3916f501210334de97350340e8537fdae10f92081f40378fe3d46346b0c753b2cb8f1169290a209d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5514c5c63a820eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e58876a9147ef9142e7d6f28dda806accb891e4054d6fa9eae670309c500b17576a914d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe6888ac'
        let res = ccUtil.redeemSriptCheck(redeemScriptSigData)
        assert.notEqual(res, undefined, 'redeemSriptCheck failed')
        assert.equal(res.HASHX.toString('hex'), 'eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5', 'redeemSriptCheck failed')
        assert.equal(res.LOCKTIME.toString('hex'), '09c500', 'redeemSriptCheck failed')
        assert.equal(res.DESTHASH160.toString('hex'), '7ef9142e7d6f28dda806accb891e4054d6fa9eae', 'redeemSriptCheck failed')
        assert.equal(res.REVOKERHASH160.toString('hex'), 'd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'redeemSriptCheck failed')
    })
    after('end', async ()=>{
        wanchainCore.close();
    });
});