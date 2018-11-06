'use strict'

const WanchainCore = require('../walletCore.js')
const bitcoin = require('bitcoinjs-lib')
const Client = require('bitcoin-core')
const config = require('../config.js')
const pu = require('promisefy-util')
const assert = require('chai').assert
const ccu= require('../ccUtil.js')

// var alice = bitcoin.ECPair.fromWIF(
//     'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
// );
// var alice = bitcoin.ECPair.fromWIF(
//     'cTgR2GrYrH3Z9UULxGEpfAhM4mAsmFRAULUwp5KYFM9R9khxYJ4v', bitcoin.networks.testnet
// );

var alice



let client;

var wanchainCore
var ccUtil
var btcUtil

describe('btc api test', () => {
  var aliceAddr
  var bobAddress

  before(async () => {
    wanchainCore = new WanchainCore(config)

    ccUtil = wanchainCore.be
    btcUtil = wanchainCore.btcUtil

    await wanchainCore.init(config)
	  client = ccUtil.client;
	  console.log('start')

    function rng () { return Buffer.from('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz') }
    alice = bitcoin.ECPair.makeRandom({ rng: rng, network: bitcoin.networks.testnet})
    aliceAddr = ccUtil.getAddress(alice)
    await client.importAddress(aliceAddr, '')
    let aliceHash160 =  bitcoin.crypto.hash160(alice.publicKey)
    console.log('aliceHash160=0x' + aliceHash160.toString('hex'))

    function rngBob () { return Buffer.from('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzr') }
    var bob = bitcoin.ECPair.makeRandom({ rng: rngBob, network: bitcoin.networks.testnet})
    bobAddress = ccUtil.getAddress(bob)
    await client.importAddress(bobAddress, '')
    let bobHash160 =  bitcoin.crypto.hash160(bob.publicKey)
    console.log('bobHash160=0x' + bobHash160.toString('hex'))
  
    //  assert.strictEqual(address, '1F5VhMHukdnUES9kfXqzPzMeF1GPHKiF64')

    /*        let txid = await client.sendToAddress(aliceAddr, 0.1);
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
*/
  })

  function sleep (milliSeconds) {
    var startTime = new Date().getTime()
    while (new Date().getTime() < startTime + milliSeconds);
  };

/*
  it('TC000: test send normal transaction', async () => {

    let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender,  1, 1000,  [aliceAddr])
    let aliceBalance = ccUtil.getUTXOSBalance(utxos)

    utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 1000,  [bobAddress])
    let bobBalance = ccUtil.getUTXOSBalance(utxos)

    console.log(' alice Balance: ' + aliceBalance)
    console.log(' bob   Balance: ' + bobBalance)

    let amount = 1
    // let res = '';
    let res = await ccUtil.btcSendTransaction([alice], amount, bobAddress, 55)
    sleep(20 * 1000)

    if (res.error != undefined) {
      assert.equal(false, true, 'error send transaction')
    }

    console.log('txid=' + res.result)

    utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 1000, [aliceAddr])
    let afteraliceBalance = ccUtil.getUTXOSBalance(utxos)

    utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 1000, [bobAddress])
    let afterbobBalance = ccUtil.getUTXOSBalance(utxos)


    console.log('after alice Balance: ' + afteraliceBalance)
    console.log('after bob   Balance: ' + afterbobBalance)

    assert.equal((aliceBalance - amount - (res.fee/100000000)).toFixed(8), afteraliceBalance.toFixed(8), 'alice balance is wrong')
    assert.equal((bobBalance + amount).toFixed(8), afterbobBalance.toFixed(8), 'bob balance is wrong')

  })
*/


  it('TC001: test decode', async () => {
    //  ?????????????????lockS: ASM  OP_IF OP_SHA256 eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5 OP_EQUALVERIFY OP_DUP OP_HASH160 7ef9142e7d6f28dda806accb891e4054d6fa9eae OP_ELSE 09c500 OP_CHECKLOCKTIMEVERIFY OP_DROP OP_DUP OP_HASH160 d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe OP_ENDIF OP_EQUALVERIFY OP_CHECKSIG
   //   ############### x: 9d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5
   // ############### hashx: eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5
   let redeemScriptSigData =  '473044022015c227f40f5dae2f8e40124eb6c2b0556c48d428208823d595803a522454ebd5022061bfb8fa71a00013d3d719d11f2b046a85162bc70c10d9831ee08aca5c3916f501210334de97350340e8537fdae10f92081f40378fe3d46346b0c753b2cb8f1169290a209d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5514c5c63a820eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e58876a9147ef9142e7d6f28dda806accb891e4054d6fa9eae670309c500b17576a914d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe6888ac';
   // let sc2 = bitcoin.script.compile(Buffer.from(redeemScriptSigData,'hex'));
   //
   //  let lockS = bitcoin.script.toASM(sc2).split(' ');
   //  console.log(lockS);
   //
   //  let sc4 = bitcoin.script.compile(Buffer.from(lockS[4],'hex'));
   //  let dex = bitcoin.script.toASM(sc4);
   //  console.log(dex);
    
    let XX = ccUtil.generatePrivateKey();
    console.log('XX=' + XX);
    
    let hashXX = ccUtil.getHashKey(XX);
    console.log('hashXX=' + hashXX);
  
    let res = ccUtil.redeemSriptCheck(redeemScriptSigData)
    
    assert.notEqual(res,undefined,'response is undefined');
    
    console.log("HASHX=" + res.HASHX.toString('hex'));
    console.log("LOCKTIME=" + res.LOCKTIME.toString('hex'));
    console.log("DESTHASH160=" + res.DESTHASH160.toString('hex'));
    console.log("DESTHASH160=" + res.REVOKERHASH160.toString('hex'));


  })

it('HTLCBTC002: test htlcbtc refund', async () => {
    let utxos = [
      {
        txId: '1',
        vout: 0,
        confirmations:3,
        value: 0.001011 * 100000000
      },
      {
        txId: '2',
        vout: 0,
        value:  0.001004 * 100000000
      },
      {
        txId: '3',
        vout: 0,
        confirmations:3,
        value:  0.06691551 * 100000000
      },
      {
        txId: '4',
        vout: 0,
        confirmations:3,
        value:  0.06855311 * 100000000
      }
  ];

    let targets =
      {
        address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
        value: 0.0000001 * 100000000
      };


    ccUtil.coinselect(utxos,targets,300);


  })
  
  
  
  
  
  
})
