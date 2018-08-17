'use strict';

const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;
const Htlc = require('../wanchaintrans/btc_cross_transactions/btcHTLCTransaction');

var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
var bob = bitcoin.ECPair.fromWIF(
    'cTgR2GrYrH3Z9UULxGEpfAhM4mAsmFRAULUwp5KYFM9R9khxYJ4v', bitcoin.networks.testnet
);

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

var wanchainCore;
var ccUtil;
var btcUtil;
var htlc;

describe('btc api test', ()=> {

    before(async () => {
        wanchainCore = new WanchainCore(config);

        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;

        await wanchainCore.init(config);
        console.log("start");
        htlc = new Htlc();
        htlc.init();

        let aliceAddr = htlc.getAddress(alice);
        let txid = await client.sendToAddress(aliceAddr, 0.1);
        console.log(txid);

        txid = await client.sendToAddress(aliceAddr, 0.12);
        console.log(txid);

        txid = await client.sendToAddress(aliceAddr, 0.2);
        console.log(txid);

        txid = await client.sendToAddress(aliceAddr, 0.5);
        console.log(txid);

        txid = await client.sendToAddress(aliceAddr, 0.8);
        console.log(txid);

        txid = await client.sendToAddress(aliceAddr, 0.16);
        console.log(txid);

        let aliceBalance = await client.getReceivedByAddress(aliceAddr, 0);
        let bobBalance = await client.getReceivedByAddress(htlc.getAddress(bob), 0);

        console.log(" alice Balance: " + aliceBalance);
        console.log(" bob   Balance: " + bobBalance);

    });

    let txid;

    it('TC001: test htlcbtc lock', async ()=>{
        txid = await htlc.btc2wbtcLock([alice],0.3,55,bob.publicKey);
    });

    it('TC002: test htlcbtc refund', async ()=>{
        txid = await htlc.btc2wbtcRefund(txid.txId,[alice]);
    });


})