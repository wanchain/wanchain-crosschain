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

const btcserver = {
  regtest: {
    network: 'regtest',
    host: '18.237.186.227',
    port: 18443,
    username: 'USER',
    password: 'PASS'
  }
}

const client = new Client(btcserver.regtest)

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
    console.log('start')

    function rng () { return Buffer.from('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz') }
    alice = bitcoin.ECPair.makeRandom({ rng: rng, network: bitcoin.networks.testnet})
    aliceAddr = ccUtil.getAddress(alice)
    await client.importAddress(aliceAddr, '')

    function rngBob () { return Buffer.from('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzr') }
    var bob = bitcoin.ECPair.makeRandom({ rng: rngBob, network: bitcoin.networks.testnet})
    bobAddress = ccUtil.getAddress(bob)
    await client.importAddress(bobAddress, '')

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


  it('TC001: test htlcbtc lock', async () => {
    // txid = await ccUtil.btc2wbtcLock([alice],0.3,55,bob.publicKey);
  })

  it('TC002: test htlcbtc refund', async () => {
    // txid = await ccUtil.btc2wbtcRefund(txid.txId,[alice]);
  })
})
