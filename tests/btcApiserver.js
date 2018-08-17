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
describe('btc api test', ()=>{
    before(async ()=>{
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init(config);
        console.log("start");
    });
    // it('TC001: send a transaction', async ()=>{
    //     const aliceAddr = "mxTSiHT4fRVysL6URcGwD5WmELTSiJV8PV";
    //     const aliceWif = "cTDgGYxyf1psvn2x1CueypAWNTXvCFL9kzhZhKZFHsP6o7LejjRi";
    //     const alice = bitcoin.ECPair.fromWIF(aliceWif,bitcoin.networks.testnet );
    //     let {address} = bitcoin.payments.p2pkh({pubkey: alice.publicKey, network: bitcoin.networks.testnet});
    //     assert.equal(address, aliceAddr, "address is wrong");
    //     let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [aliceAddr]);
    //     console.log("utxos: ", utxos);
    //
    //     const amount = "0.01";
    //     const amount2 = "90000";
    //     let txHash = await client.sendToAddress(address, amount);
    //     await client.generate(1);
    //
    //     utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [address]);
    //     console.log("utxos: ", utxos);
    //     let utxo;
    //     for(let i=0; i<utxos.length; i++){
    //         console.log("typeof amount:", typeof(utxos[i].amount));
    //         console.log("amount:", utxos[i].amount);
    //         console.log("Number(amount):", Number(amount));
    //         if(utxos[i].amount == Number(amount)){
    //             utxo = utxos[i];
    //             console.log("find utxo:", utxo);
    //             break;
    //         }
    //     }
    //     assert.equal(amount, utxo.amount, "utxo is wrong");
    //     console.log("utxo: ", utxo);
    //     const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
    //
    //     txb.setVersion(1);
    //     txb.addInput(utxo.txid, utxo.vout);
    //     txb.addOutput('mkuNvfqgGM3EEWkYNEMxP4KzzDWfXc5cEX', Number(amount2));
    //     txb.sign(0, alice);
    //
    //     const rawTx = txb.build().toHex();
    //     console.log("rawTx: ", rawTx);
    //
    //     let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
    //     console.log("result hash:", result);
    // });
    /*
    it('TC001: get utxo of a random address', async ()=>{
        let toPair = bitcoin.ECPair.makeRandom({network:bitcoin.networks.testnet});
        let {address} = bitcoin.payments.p2pkh({pubkey: toPair.publicKey, network: bitcoin.networks.testnet});
        let txHash = await client.sendToAddress(address, "0.01");
        await client.generate(1);
        let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [address]);
        console.log("utxos: ", utxos);
        await pu.sleep(10000);
        utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [address]);
        console.log("utxos: ", utxos);
    });
    it('TC001: get block number', async ()=>{
        let height = await ccUtil.getBlockNumber(ccUtil.btcSender);
        console.log("block number: ", height);
    });
    it('TC001: get raw transaction', async ()=>{
        let hash = "baaa32a51ef1e31a78916cec87a79d778969222d40558d1e730fc45a61192ad4";
        let tx = await ccUtil.getTxInfo(ccUtil.btcSender, hash);
        console.log("get transaction: ", tx);
    });
    */
    // it('create btc addr', ()=>{
    //     btcUtil.createBtcAddr();
    // });

    // it('get all ECPair', async ()=>{
    //     // mocha --timeout 100000 test.js
    //     let result = await btcUtil.getECPairs('1234567890');
    //     console.log('result: ', result);
    // });

   //  it('get all btcAddress', async ()=>{
   //      // mocha --timeout 100000 test.js
   //      let result = await btcUtil.getAddress();
   //      console.log('result: ', result);
   //
   //     let toPair = bitcoin.ECPair.makeRandom({network:bitcoin.networks.testnet});
   //     let {address} = bitcoin.payments.p2pkh({pubkey: toPair.publicKey, network: bitcoin.networks.testnet});
   //     let txHash = await client.sendToAddress(address, "0.01");
   //     await client.generate(1);
   //     let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [address]);
   //     console.log("utxos: ", utxos);
   //     await pu.sleep(10000);
   //     utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [address]);
   //     console.log("utxos: ", utxos);
   // });
   // it('TC001: get block number', async ()=>{
   //     let height = await ccUtil.getBlockNumber(ccUtil.btcSender);
   //     console.log("block number: ", height);
   // });
   // it('TC001: get raw transaction', async ()=>{
   //     let hash = "baaa32a51ef1e31a78916cec87a79d778969222d40558d1e730fc45a61192ad4";
   //     let tx = await ccUtil.getTxInfo(ccUtil.btcSender, hash);
   //     console.log("get transaction: ", tx);
   // });

    // it('create btcAddress', async ()=>{
    //     // mocha --timeout 100000 test.js
    //     let result = await btcUtil.createAddress('1234567890');
    //     console.log('result: ', result);
    // });

    it('get btc address list', async ()=>{
        // mocha --timeout 100000 test.js
        let result = await btcUtil.getAddress();
        console.log('result: ', result);
    });

    after('end', async ()=>{
        wanchainCore.close();
    })
});

