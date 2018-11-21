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

    it('TC002: create btc addr', async ()=>{
        let newBtcAddress;

        newBtcAddress =  await btcUtil.createAddress(defaultBtcPasswd);
        // await ccUtil.btcImportAddress(ccUtil.btcSender, newBtcAddress);

        try {
            await bs58check.decode(newBtcAddress.address);
            isAddress = true;
        } catch (error) {
            print4debug(`BTC address is invalid: ${e}`);
        }

        print4debug('New BTC Address: ', newBtcAddress.address);

        assert.strictEqual(isAddress, true);
    });

    it('TC003: get all btcAddress', async ()=>{
        // mocha --timeout 100000 test.js
        let result;
        try{
            result = await btcUtil.getAddressList();
            isAddress = true
        } catch(e) {
            print4debug(`get all btcAddress: ${e}`);
        }
        print4debug(`get all btcAddress:`, result);

        assert.strictEqual(isAddress, true);
    });

    it('TC004: remove btc address', async ()=>{
        let beforeList = await btcUtil.getAddressList();
        let result = beforeList[beforeList.length -1];
        console.log('result: ', result.address);
        await btcUtil.removeAddress(result.address, defaultBtcPasswd);

        let afterList = await btcUtil.getAddressList();
        let afterResult = afterList[afterList.length -1];
        console.log('afterResult: ', afterResult.address);

        assert.notStrictEqual(result.address, afterResult.address);
    });

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

    it('TC006: get btc block number', async ()=>{
        let height = await ccUtil.getBlockNumber(ccUtil.btcSender);
        console.log("block number: ", height);
    });

    it('TC007: get all ECPair', async ()=>{
        let result = await btcUtil.getECPairs(defaultBtcPasswd);
        console.log('result: ', result);
    });

    it('TC008: address2hash160', async () => {
        let address = (await btcUtil.getAddressList())[0].address;

        var alice = bitcoin.ECPair.fromWIF(address, bitcoin.networks.testnet)
        let addr = btcUtil.getAddressbyKeypair(alice)
        let hash160 = btcUtil.addressToHash160(addr, 'pubkeyhash', 'testnet')

        console.log('the hash160 from address = ' + hash160)
        let expectedH160 = bitcoin.crypto.hash160(alice.publicKey).toString('hex')
        console.log('the expected hash160 from address =' + expectedH160.toString('hex'))
        assert.equal(hash160, expectedH160, 'address2hash160 failed')
    });

    it('TC009: Storemanfund', async ()=>{
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

    it('TC010: hash160ToAddress', async ()=> {
        let userH160 = "83C96ffdCE7A2206421A4C33B2CF2030CE53e772";
        let addr = btcUtil.hash160ToAddress(userH160,'pubkeyhash','mainnet');
        console.log("the address from hash160: " + addr);
        assert.equal(addr, '1D1pqFX6zm9rVEwquZbdmHwAYYeCCVm6dE', 'hash160ToAddress failed')
    });

})