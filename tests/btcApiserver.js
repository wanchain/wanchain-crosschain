'use strict';

const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;

let client;

let wanchainCore;
let ccUtil;
let btcUtil;
describe('btc api test', ()=>{
    before(async ()=>{
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        await wanchainCore.init();
	    client = ccUtil.client;
        console.log("start");
    });

    it('TC001: send a transaction', async ()=>{
        const aliceAddr = "mtCotFuC1JP448Y3uhEbyPeP7UduYUn6Vb";
        const aliceWif = "6PYSkjxao4iBgTn4mW5AgYD77PtwePM8a9UmpKm8snRc4A4SqryGpvHief";
        const alice = bitcoin.ECPair.fromWIF(aliceWif,bitcoin.networks.testnet );
        let {address} = bitcoin.payments.p2pkh({pubkey: alice.publicKey, network: bitcoin.networks.testnet});
        assert.equal(address, aliceAddr, "address is wrong");
        let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [aliceAddr]);
        console.log("utxos: ", utxos);

        const amount = "0.01";
        const amount2 = "90000";
        let txHash = await client.sendToAddress(address, amount);
        await client.generate(1);

        utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 0, 10000000, [address]);
        console.log("utxos: ", utxos);
        let utxo;
        for(let i=0; i<utxos.length; i++){
            console.log("typeof amount:", typeof(utxos[i].amount));
            console.log("amount:", utxos[i].amount);
            console.log("Number(amount):", Number(amount));
            if(utxos[i].amount == Number(amount)){
                utxo = utxos[i];
                console.log("find utxo:", utxo);
                break;
            }
        }
        assert.equal(amount, utxo.amount, "utxo is wrong");
        console.log("utxo: ", utxo);
        const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);

        txb.setVersion(1);
        txb.addInput(utxo.txid, utxo.vout);
        txb.addOutput('mkuNvfqgGM3EEWkYNEMxP4KzzDWfXc5cEX', Number(amount2));
        txb.sign(0, alice);

        const rawTx = txb.build().toHex();
        console.log("rawTx: ", rawTx);

        let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
        console.log("result hash:", result);
    });
    it('TC002: get utxo of a random address', async ()=>{
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
    it('TC003: get block number', async ()=>{
        let height = await ccUtil.getBlockNumber(ccUtil.btcSender);
        console.log("block number: ", height);
    });
    it('TC004: get raw transaction', async ()=>{
        let hash = "7168a86c84eda0bbfb7ae553118b02983516e8a6c448dc4c0630d26299297f20";
        let tx = await ccUtil.getTxInfo(ccUtil.btcSender, hash);
        console.log("get transaction: ", tx);
    });
    it('TC005: create btc addr', null, async ()=>{
        await btcUtil.createAddress('1234567890');
    });


    it('TC007: get all btcAddress', async ()=>{
        let result = await btcUtil.getAddressList();
        console.log('result: ', result);
   });

    it('TC006: get all ECPair', async ()=>{
        let result = await btcUtil.getECPairs('1234567890');
        console.log('result: ', result);
    });

   it('TC008: get block number', async ()=>{
       console.log('tc008start');
       let height = await ccUtil.getBlockNumber(ccUtil.btcSender);
       console.log("block number: ", height);
       console.log('tc008end');
   });
   it('TC009: get raw transaction', async ()=>{
       let hash = "7168a86c84eda0bbfb7ae553118b02983516e8a6c448dc4c0630d26299297f20";
       let tx = await ccUtil.getTxInfo(ccUtil.btcSender, hash);
       console.log("get transaction: ", tx);
   });

    it('TC011: get btc address list', async ()=>{
        let result = await btcUtil.getAddressList();
        console.log('result: ', result);
    });
    it('TC012: getP2shxByHashx', async ()=>{
        let result = await ccUtil.getP2shxByHashx(ccUtil.btcSender, "f0370fd4cf3f85a17e770213923f64e1212aafe72f33b3a3b0a82b5ae1852774");
        console.log('result: ', result);
    });
    it('TC013: getUtxoValueById', async ()=>{
        const txid = "7168a86c84eda0bbfb7ae553118b02983516e8a6c448dc4c0630d26299297f20";  // 12345000
        let value;
        value = await ccUtil.getUtxoValueByIdStoreman(txid);
        console.log('getUtxoValueByIdStoreman result: ', value);
        assert(value, 12345000,"wrong value");
        value = await ccUtil.getUtxoValueByIdWallet(txid);
        assert(value, 12345000,"wrong value");
        console.log('getUtxoValueByIdWallet result: ', value);
    });

    after('end', async ()=>{
        wanchainCore.close();
        //process.exit(0);
    })
});

