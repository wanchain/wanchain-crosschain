'use strict';

const WanchainCore = require('../walletCore.js');
const bitcoin  = require('bitcoinjs-lib');
const config = require('../config.js');
const pu = require('promisefy-util');
const assert = require('chai').assert;
var alice = bitcoin.ECPair.fromWIF(
  'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);

let client;

let wanchainCore;
let ccUtil;
let btcUtil;
describe('btc basic api test', ()=>{
  before(async ()=>{
    wanchainCore = new WanchainCore(config);
    ccUtil = wanchainCore.be;
    btcUtil = wanchainCore.btcUtil;
    await wanchainCore.init();
    client = ccUtil.client;
    console.log("start");
  });
  it('TC001: createAddress getAddressList getAddressbyKeypair', async ()=>{
    const passwd = '12345678';
    let addr = await btcUtil.createAddress(passwd);
    addr = addr.address;
    assert.notEqual(null, addr, 'createAddress failed');
    console.log("addr: ", addr);

    let addrs = await btcUtil.getAddressList();
    let index = -1;
    for(let i=0; i<addrs.length; i++) {
      if(addr == addrs[i].address){
        index = i;
        break;
      }
    }
    assert.notEqual(-1, index, 'getAddressList failed');

    let ecPair = await btcUtil.getECPairsbyAddr(passwd, addr);
    let addr2 = btcUtil.getAddressbyKeypair(ecPair);
    assert.equal(addr, addr2,'getAddressbyKeypair failed');
  });
  it('HTLCBTC002: coinselect', async () => {
    let utxos = [
      {
        txId: '1',
        vout: 0,
        confirmations:3,
        value: 101100
      },
      {
        txId: '2',
        vout: 0,
        value:  100400
      },
      {
        txId: '3',
        vout: 0,
        confirmations:3,
        value:  6691551
      },
      {
        txId: '4',
        vout: 0,
        confirmations:3,
        value:  6855311
      }
    ];

    let targets =
      {
        address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
        value: 100
      };
    let ret = ccUtil.coinselect(utxos,targets,300);
    console.log(ret);
  });
  it('TC001: address2hash160', async ()=> {

    let addr = btcUtil.getAddressbyKeypair(alice);
    let hash160 = btcUtil.addressToHash160(addr,'pubkeyhash','testnet');

    console.log("the hash160 from address = " + hash160)
    let expectedH160 = bitcoin.crypto.hash160(alice.publicKey).toString('hex');

    console.log("the expected hash160 from address =" + expectedH160.toString('hex'))

    assert.equal(hash160,expectedH160,"the address not match")

    let addr2 = "mnAqWSmymTpJRcsPmN5uTDA2uFxPZTX29j";
    let hash1602 = btcUtil.addressToHash160(addr2,'pubkeyhash','testnet');
    const hash1602_exp = '48fae572da888c19692519282d166896fddb7924';
    console.log("hash1602: ",hash1602);
    assert.equal(hash1602,hash1602_exp,"the address not match")
  });

  after('end', async ()=>{
    wanchainCore.close();
    process.exit(0);
  })
});

