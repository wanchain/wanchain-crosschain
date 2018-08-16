// this code is equal to https://github.com/wanchain/crossBtc/blob/master/docs/python-poc/simple_btc_htlc.py
'use strict';

const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;

const btcserver={
    regtest:{
        network: 'regtest',
        host: "18.237.186.227",
        port: 18443,
        username: "USER",
        password: "PASS"
    }
};

const client = new Client(btcserver.regtest);


let wanchainCore;
let ccUtil;
let btcUtil;


const network = bitcoin.networks.testnet;

const FEE = 0.001


function getAddress(keypair){
    const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
    return pkh.address;
}

const secret = 'LgsQ5Y89f3IVkyGJ6UeRnEPT4Aum7Hvz';
const commitment = 'bf19f1b16bea379e6c3978920afabb506a6694179464355191d9a7f76ab79483';
const storemanHash160 = Buffer.from('d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'hex');
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


async function hashtimelockcontract(storemanHash160,xHash, locktime){
    let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);

    print4debug("blocknum:" + blocknum);
    print4debug("Current blocknum on Bitcoin: " + blocknum);
    let redeemblocknum = blocknum + locktime;
    print4debug("Redeemblocknum on Bitcoin: " + redeemblocknum);

    let redeemScript = bitcoin.script.compile([
        /* MAIN IF BRANCH */
        bitcoin.opcodes.OP_IF,
        bitcoin.opcodes.OP_SHA256,
        Buffer.from(xHash, 'hex'),
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,

        storemanHash160,// wallet don't know storeman pubkey. //bitcoin.crypto.hash160(storeman.publicKey),//storeman.getPublicKeyBuffer(),// redeemer address
        //bitcoin.crypto.hash160(storeman.publicKey),
        bitcoin.opcodes.OP_ELSE,
        bitcoin.script.number.encode(redeemblocknum),
        bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
        bitcoin.opcodes.OP_DROP,
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,

        bitcoin.crypto.hash160(alice.publicKey),//alice.getPublicKeyBuffer(), // funder addr
        /* ALMOST THE END. */
        bitcoin.opcodes.OP_ENDIF,

        // Complete the signature check.
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_CHECKSIG
    ]);
    print4debug(redeemScript.toString('hex'));
    //var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
    //var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

    let addressPay = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: network }, network: network });
    let address = addressPay.address;

    await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 100, [address]);

    return {
        'p2sh': address,
        'redeemblocknum' : redeemblocknum,
        'redeemScript': redeemScript,
        'locktime': locktime
    }

}
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
    let contract = await hashtimelockcontract(storemanHash160, commitment, redeemLockTimeStamp);
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
        network: bitcoin.networks.regtest
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


async function main(){
    await client.generate(1);

    await client.importAddress(getAddress(alice), "");
    await client.importAddress(getAddress(storeman), "");

    await showBalance('Begin');

    await testRedeem();

    await showBalance('End');
}



describe('btc api test', ()=> {
    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);

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
    it('TC002: htlc lock', async ()=>{
        let txhash = await fundHtlc();
        lastTxid = txhash;
        console.log("htcl lock hash: ", txhash);
        let rawTx = await ccUtil.getTxInfo(ccUtil.btcSender, txhash);
        console.log("rawTx:", rawTx);
        console.log("rawTx.length:", rawTx.length);
        let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'));
        console.log(ctx.outs);
        let outs = ctx.outs;
        for(let i=0; i<outs.length; i++) {
            let out = outs[i];
            let outScAsm = bitcoin.script.toASM(out.script);
            let outScHex = out.script.toString('hex');
            console.log("outScAsm", outScAsm);
            console.log("outScHex", outScHex);
        }
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

    after('end', async ()=>{
        wanchainCore.close();
    });
});
