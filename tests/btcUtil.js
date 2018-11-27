'use strict'

const WanchainCore = require('../walletCore.js')
const bitcoin = require('bitcoinjs-lib')
const config = require('../config.js')
const pu = require('promisefy-util')
const assert = require('chai').assert
var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
)

let client

let wanchainCore
let ccUtil
let btcUtil
describe('btc basic api test', () => {
    before(async () => {
        wanchainCore = new WanchainCore(config)
        ccUtil = wanchainCore.be
        btcUtil = wanchainCore.btcUtil
        await wanchainCore.init()
        client = ccUtil.client
        console.log('start')
    })
    it('TC001: createAddress getAddressList getAddressbyKeypair', async () => {
        const passwd = '12345678'
        let addr = await btcUtil.createAddress(passwd)
        addr = addr.address
        assert.notEqual(null, addr, 'createAddress failed')
        console.log('addr: ', addr)

        let addrs = await btcUtil.getAddressList()
        let index = -1
        for (let i = 0; i < addrs.length; i++) {
            if (addr == addrs[i].address) {
                index = i
                break
            }
        }
        assert.notEqual(-1, index, 'getAddressList failed')

        let ecPair = await btcUtil.getECPairsbyAddr(passwd, addr)
        let addr2 = btcUtil.getAddressbyKeypair(ecPair)
        assert.equal(addr, addr2, 'getAddressbyKeypair failed')
    })
    it('HTLCBTC002: coinselect', async () => {
        let utxos = [
            {
                txId: '1',
                vout: 0,
                confirmations: 3,
                value: 101100
            },
            {
                txId: '2',
                vout: 0,
                value: 100400
            },
            {
                txId: '3',
                vout: 0,
                confirmations: 3,
                value: 6691551
            },
            {
                txId: '4',
                vout: 0,
                confirmations: 3,
                value: 6855311
            }
        ]

        let targets =
            {
                address: '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm',
                value: 100
            }
        let ret = ccUtil.coinselect(utxos, targets, 300)
        console.log(ret)
    })
    it('TC001: address2hash160', async () => {
        let addr = btcUtil.getAddressbyKeypair(alice)
        let hash160 = btcUtil.addressToHash160(addr, 'pubkeyhash', 'testnet')

        console.log('the hash160 from address = ' + hash160)
        let expectedH160 = bitcoin.crypto.hash160(alice.publicKey).toString('hex')
        console.log('the expected hash160 from address =' + expectedH160.toString('hex'))
        assert.equal(hash160, expectedH160, 'address2hash160 failed')

        let addr2 = 'mnAqWSmymTpJRcsPmN5uTDA2uFxPZTX29j'
        let hash1602 = btcUtil.addressToHash160(addr2, 'pubkeyhash', 'testnet')
        const hash1602_exp = '48fae572da888c19692519282d166896fddb7924'
        console.log('hash1602: ', hash1602)
        assert.equal(hash1602, hash1602_exp, 'address2hash160 failed')
    });
    it('TC001: hash160ToAddress', async ()=> {
        let userH160 = "8aA1955D1Dd388ec13b1F92A3D3861bF4D0B765C".toLowerCase();
        let addr = btcUtil.hash160ToAddress(userH160,'pubkeyhash','mainnet');
        console.log("the address from hash160: " + addr);
        assert.equal(addr, '1D1pqFX6zm9rVEwquZbdmHwAYYeCCVm6dE', 'hash160ToAddress failed')
    });

    it('TC031: redeemSriptCheck', async ()=> {
        let rawTx = "010000000146d1c29fda08598536aba9620632d9707a3da2f5c1e65abd9c6fbfa4c57f8c2300000000eb473044022075125fbd3518eee4d9eef710571304c0c56c6870c6cf81988e4e5e48e81bab4d02206a4d4858e70a4f73ac0fb0166466e4aeba7f0e4359331b4d110efd062292ed850121027342e5e9e09ea43b0ba299ca876e1079d85eb13183e273f8370aca199da7818d20fa455ed58d6bd4d113568163f690386450a35b4a2ef1ae102d1ec1b0af4f70ea514c5d63a820d0355f64e97f9346c10d47ffde69572d3599168f902bacfed18252542b7c28e68876a9149fbe5cfb59c0d678f56d172379f0bcdbcd6ef1b26704ef2fd95bb17576a91483c96ffdce7a2206421a4c33b2cf2030ce53e7726888acffffffff0130e60200000000001976a9149fbe5cfb59c0d678f56d172379f0bcdbcd6ef1b288ac00000000";
        let ctx = bitcoin.Transaction.fromHex(rawTx);
        let result = ccUtil.redeemSriptCheck(ctx.ins[0].script.toString('hex'));
        if( !(result instanceof Error)) {
            // only handle REVOKERHASH160 is storeman
            const stmRipemd160Addr = ("83C96ffdCE7A2206421A4C33B2CF2030CE53e772").toLowerCase();
            console.log("result.REVOKERHASH160: ", result.REVOKERHASH160,"stmRipemd160Addr", stmRipemd160Addr);
            assert.equal(result.REVOKERHASH160 , stmRipemd160Addr, "stmRipemd160Addr is wrong")
        }
    });
    it('TC041 hashtimelockcontract', async ()=>{
        let hashx = "7a2a81fd65f8d514fdc11776b5180d4e31fc03eb61c29dd94183dd8bac0034d1";
        let redeemLockTimeStamp = 1542115203;
        let destHash160Addr =  "83e5ca256c9ffd0ae019f98e4371e67ef5026d2d"
        let revokerHash160Addr = "37d6f2c6da7bdad4ac3015c7dc733c26cb7bb486"
        let contract = btcUtil.hashtimelockcontract (hashx, redeemLockTimeStamp, destHash160Addr, revokerHash160Addr);
        console.log("hashtimelockcontract contract: ", contract);
        assert.equal('2N67BCDsiqr6yX2eAzRqBwDj896X16UZhm7', contract.p2sh, "hashtimelockcontract p2sh failed");
    });
    it('TC050: redeemSriptCheck', async () => {
        let redeemScriptSigData = '473044022015c227f40f5dae2f8e40124eb6c2b0556c48d428208823d595803a522454ebd5022061bfb8fa71a00013d3d719d11f2b046a85162bc70c10d9831ee08aca5c3916f501210334de97350340e8537fdae10f92081f40378fe3d46346b0c753b2cb8f1169290a209d5b27cd395af22ce9a30a11c0ea62d6add2864da21b5a11410d3b8a17aac1b5514c5c63a820eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e58876a9147ef9142e7d6f28dda806accb891e4054d6fa9eae670309c500b17576a914d3a80a8e8bf8fbfea8eee3193dc834e61f257dfe6888ac'
        let res = ccUtil.redeemSriptCheck(redeemScriptSigData)
        assert.notEqual(res, undefined, 'redeemSriptCheck failed')
        assert.equal(res.HASHX.toString('hex'), 'eb8f616b3f2f4137639185a10458e918e04b8d6c30c24007be3542a80f6e11e5', 'redeemSriptCheck failed')
        assert.equal(res.LOCKTIME.toString('hex'), '09c500', 'redeemSriptCheck failed')
        assert.equal(res.DESTHASH160.toString('hex'), '7ef9142e7d6f28dda806accb891e4054d6fa9eae', 'redeemSriptCheck failed')
        assert.equal(res.REVOKERHASH160.toString('hex'), 'd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe', 'redeemSriptCheck failed')
    })
    it('TC051: interpreter', ()=>{
        let Script = require('bitcore-lib').Script;
        let Interpreter = Script.Interpreter;
        let x = '1111111111111111111111111111111122222222222222222222222222222222';
        let sigHash = Buffer.from('33333333333333333333333333333333');
        let scriptSig = bitcoin.script.compile([
            bitcoin.script.signature.encode(alice.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
            alice.publicKey,
            Buffer.from(x, 'hex'),
            bitcoin.opcodes.OP_TRUE,
        ]);
        console.log("scriptSig:", scriptSig);
        let intptr = new Interpreter({
            script: Script.fromBuffer(scriptSig),
            tx: null,
            nin: 0,
            flags: Interpreter.SCRIPT_VERIFY_P2SH
        });
        // evaluate scriptSig
        if (!intptr.evaluate()) {
            throw(new Error("interpreter failed"));
        }
        let stackCopy = intptr.stack.slice();
        console.log("stackCopy:", stackCopy);
        assert.equal(stackCopy[stackCopy.length-1].toString('hex'), 1, "interpreter failed");
        assert.equal(stackCopy[stackCopy.length-2].toString('hex'), x, "interpreter failed");
    })

    after('end', async () => {
        wanchainCore.close()
    })
})

