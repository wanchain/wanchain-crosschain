const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const Client = require('bitcoin-core');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;
const Web3 = require("web3");
var web3 = new Web3();
var bs58check = require('bs58check');
let utils = require('./utils/script');

let client;

describe('Test CrossBTC Sdk', () => {
    
    let wanchainCore;
    let ccUtil;
    let btcUtil;
    
    let btcNetwork = bitcoin.networks.testnet;
    let btcNetworkName = 'testnet';

    let defaultBtcPasswd = '1234567890';
    let isAddress = false;

    let print4debug = console.log;

    before(async () => {
        wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
        client = ccUtil.client;
        await wanchainCore.init(config);
    });

    // it('TC002: create btc addr', async ()=>{
    //     let newBtcAddress;

    //     newBtcAddress =  await btcUtil.createAddress(defaultBtcPasswd);
    //     // await ccUtil.btcImportAddress(ccUtil.btcSender, newBtcAddress);

    //     try {
    //         await bs58check.decode(newBtcAddress.address);
    //         isAddress = true;
    //     } catch (error) {
    //         print4debug(`BTC address is invalid: ${e}`);
    //     }

    //     print4debug('New BTC Address: ', newBtcAddress.address);

    //     assert.strictEqual(isAddress, true);
    // });

    // it('TC003: get all btcAddress', async ()=>{
    //     // mocha --timeout 100000 test.js
    //     let result;
    //     try{
    //         result = await btcUtil.getAddressList();
    //         isAddress = true
    //     } catch(e) {
    //         print4debug(`get all btcAddress: ${e}`);
    //     }
    //     print4debug(`get all btcAddress:`, result);

    //     assert.strictEqual(isAddress, true);
    // });

    // it('TC004: remove btc address', async ()=>{
    //     let beforeList = await btcUtil.getAddressList();
    //     let result = beforeList[beforeList.length -1];
    //     console.log('result: ', result.address);
    //     await btcUtil.removeAddress(result.address, defaultBtcPasswd);

    //     let afterList = await btcUtil.getAddressList();
    //     let afterResult = afterList[afterList.length -1];
    //     console.log('afterResult: ', afterResult.address);

    //     assert.notStrictEqual(result.address, afterResult.address);
    // });

    it('TC005: get utxo of a random address', async ()=>{
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

})