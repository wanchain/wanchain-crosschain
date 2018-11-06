// this code is equal to https://github.com/wanchain/crossBtc/blob/master/docs/python-poc/simple_btc_htlc.py
'use strict';

const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

let client;

let wanchainCore;
let ccUtil;
let btcUtil;


const network = bitcoin.networks.testnet;

const FEE = 0.001


function getAddress(keypair){
    const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
    return pkh.address;
}

let secret = 'LgsQ5Y89f3IVkyGJ6UeRnEPT4Aum7Hvz';
let commitment = 'bf19f1b16bea379e6c3978920afabb506a6694179464355191d9a7f76ab79483';
const storemanHash160 = Buffer.from('d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'hex');
const storemanHash160Addr = "0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe";
const storemanWif = 'cQrhq6e1bWZ8YBqaPcg5Q8vwdhEwwq1RNsMmv2opPQ4fuW2u8HYn';
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, bitcoin.networks.testnet
);
console.log("storemanHash160:", storemanHash160.toString('hex'));
console.log("hash160 of publicKey:", bitcoin.crypto.hash160(storeman.publicKey).toString('hex'));

var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const aliceAddr = getAddress(alice);
const storemanAddr = getAddress(storeman);



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
let lastContract;
let lastTxid;
const value = 1;
const value2 = 2;
async function fundHtlc(){
    let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [aliceAddr]);
    console.log("utxos: ", utxos);

    let utxo = selectUtxo(utxos, value2);
    assert.equal(value2, utxo.amount, "getBtcUtxo is wrong");
    console.log("utxo: ", utxo);

    // generate script and p2sh address
    let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);
    const lockTime = 1000;
    let redeemLockTimeStamp = blocknum + lockTime;
    let contract = await btcUtil.hashtimelockcontract(storemanHash160,  redeemLockTimeStamp);
    lastContract = contract;
    const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
    txb.setVersion(1);
    txb.addInput(utxo.txid, utxo.vout);
    txb.addOutput(contract['p2sh'], value*100000000); // fee is 1
    txb.sign(0, alice);

    const rawTx = txb.build().toHex();
    console.log("rawTx: ", rawTx);

    let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
    console.log("result hash:", result);
    return result;
}


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





describe('btc api test', ()=> {
    before(async () => {
        config.btcServerNet = {
            network: 'regtest',
            host: "127.0.0.1",
            port: 18443,
            username: "USER",
            password: "PASS"
        };
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
	    client = ccUtil.client;

        console.log("send alice 1 BTC for test.")
        let txHash = await client.sendToAddress(aliceAddr, 2);
        await client.generate(1);

        console.log("start");
    });

    it('TC001: basic function check', async ()=>{
        // let x = 'LgsQ5Y89f3IVkyGJ6UeRnEPT4Aum7Hvz';
        // let hashx = bitcoin.crypto.sha256(x).toString('hex');
        // assert.equal('bf19f1b16bea379e6c3978920afabb506a6694179464355191d9a7f76ab79483', hashx, "sha256 is wrong");

        // let rawTx = "0100000001baeff8d42374f0a652dc0f5590bd7c566dce4d7c6514e165db40e2286de13bc1010000006b483045022100ad59b7ed3e189545ce5a0935165b3ade819cfdc3b43d91b155cf202b9f243759022064582b0de66e3e806985559314c6dc756b4d146c9deb9382c2dbf3c945ec407a01210334de97350340e8537fdae10f92081f40378fe3d46346b0c753b2cb8f1169290affffffff01010000000000000017a91417316603940778715012bcf7fd49ef11c4be0f568700000000";
        // let btx = Buffer.from(rawTx,'hex');
        // console.log("btx:", btx);
        // let ctx = bitcoin.Transaction.fromHex(btx,bitcoin.networks.testnet);
        // console.log(ctx);
    });
    it('TC002: htlc lock and wan notice', async ()=>{
        let tx = btcUtil.btc2wbtcLock();
        let txhash = await fundHtlc();
        lastTxid = txhash;
        console.log("htcl lock hash: ", txhash);
        tx = {};
        tx.storeman = storemanHash160Addr;
        tx.userWanAddr = "0xbd100cf8286136659a7d63a38a154e28dbf3e0fd";
        tx.hashx=lastContract.hashx;
        tx.txhash = '0x'+txhash;
        tx.lockedTimestamp = lastContract.lockedTimestamp;
        tx.gas = '1000000';
        tx.gasPrice = '200000000000'; //200G;
        tx.passwd='wanglu';
        let txHash = await ccUtil.sendWanNotice(ccUtil.wanSender, tx);
        console.log("sendWanNotice txHash:", txHash);

        // check the utxo is received.
        // async _verifyBtcUtxo(storemanAddr, txHash, xHash, lockedTimestamp)
        let amount = await ccUtil._verifyBtcUtxo(storemanHash160, txhash, lastContract.hashx, lastContract.lockedTlimestamp);
        console.log("amount:   ", amount);
        await pu.sleep(40000);
        console.log( await web3.eth.getTransactionReceipt(txHash));

    });
    // it('TC002: htlc lock', async ()=>{
    //     let txhash = await fundHtlc();
    //     lastTxid = txhash;
    //     console.log("htcl lock hash: ", txhash);
    //     let rawTx = await ccUtil.getTxInfo(ccUtil.btcSender, txhash);
    //     console.log("rawTx:", rawTx);
    //     console.log("rawTx.length:", rawTx.length);
    //     let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'));
    //     console.log(ctx.outs);
    //     let outs = ctx.outs;
    //     for(let i=0; i<outs.length; i++) {
    //         let out = outs[i];
    //         let outScAsm = bitcoin.script.toASM(out.script);
    //         let outScHex = out.script.toString('hex');
    //         console.log("outScAsm", outScAsm);
    //         console.log("outScHex", outScHex);
    //     }
    // });
    //
    // it('TC003: htlc redeem', async ()=>{
    //     let hashid = await redeem(lastContract, {txid:lastTxid, vout:0}, secret);
    //     console.log("redeem hashid: ", hashid);
    //     let rawTx = await ccUtil.getTxInfo(ccUtil.btcSender, hashid);
    //     console.log("rawTx:", rawTx);
    //     let btx = Buffer.from(rawTx,'hex');
    //     console.log("btx:", btx);
    //     let ctx = bitcoin.Transaction.fromHex(btx,bitcoin.networks.testnet);
    //     console.log(ctx);
    //     let ins = ctx.ins;
    //     for(let i=0; i<ins.length; i++) {
    //         let inItem = ins[i];
    //         let inScAsm = bitcoin.script.toASM(inItem.script);
    //         let inScHex = inItem.script.toString('hex');
    //         console.log("inScAsm", inScAsm);
    //         console.log("inScHex", inScHex);
    //     }
    // });
    it('TC001: test decode', async () => {
        //  ?????????????????lockS: ASM  OP_IF OP_SHA256 eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5 OP_EQUALVERIFY OP_DUP OP_HASH160 7ef9142e7d6f28dda806accb891e4054d6fa9eae OP_ELSE 09c500 OP_CHECKLOCKTIMEVERIFY OP_DROP OP_DUP OP_HASH160 d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe OP_ENDIF OP_EQUALVERIFY OP_CHECKSIG
        //   ############### x: 9d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5
        // ############### hashx: eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5
        let redeemScriptSigData = '473044022015c227f40f5dae2f8e40124eb6c2b0556c48d428208823d595803a522454ebd5022061bfb8fa71a00013d3d719d11f2b046a85162bc70c10d9831ee08aca5c3916f501210334de97350340e8537fdae10f92081f40378fe3d46346b0c753b2cb8f1169290a209d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5514c5c63a820eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e58876a9147ef9142e7d6f28dda806accb891e4054d6fa9eae670309c500b17576a914d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe6888ac'
        // let sc2 = bitcoin.script.compile(Buffer.from(redeemScriptSigData,'hex'));
        //
        //  let lockS = bitcoin.script.toASM(sc2).split(' ');
        //  console.log(lockS);
        //
        //  let sc4 = bitcoin.script.compile(Buffer.from(lockS[4],'hex'));
        //  let dex = bitcoin.script.toASM(sc4);
        //  console.log(dex);

        let XX = ccUtil.generatePrivateKey()
        console.log('XX=' + XX)

        let hashXX = ccUtil.getHashKey(XX)
        console.log('hashXX=' + hashXX)

        let res = ccUtil.redeemSriptCheck(redeemScriptSigData)

        assert.notEqual(res, undefined, 'response is undefined')

        console.log('HASHX=' + res.HASHX.toString('hex'))
        console.log('LOCKTIME=' + res.LOCKTIME.toString('hex'))
        console.log('DESTHASH160=' + res.DESTHASH160.toString('hex'))
        console.log('DESTHASH160=' + res.REVOKERHASH160.toString('hex'))

    })
    after('end', async ()=>{
        wanchainCore.close();
    });
});
