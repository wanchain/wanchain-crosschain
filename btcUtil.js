'use strict'

const Address = require('btc-address')
const binConv = require('binstring')
const bitcoin = require('bitcoinjs-lib')
const wif = require('wif')
const bip38 = require('bip38')
const crypto = require('crypto')
const config = require('./config')
const secp256k1 = require('secp256k1')
const cm = require('./comm.js')

let bitcoinNetwork = config.bitcoinNetwork
let version = config.bitcoinVersion

function hexTrip0x (hexs) {
    if (0 == hexs.indexOf('0x')) {
        return hexs.slice(2)
    }
    return hexs
}

let logger=console;
const btcUtil = {
    init (log) {
        if(log){
            logger = log;
        }else{
            logger = cm.getLogger('btcUtil')
        }
    },
    getBtcWallet () {
        return cm.walletDb.getCollection('btcAddress')
    },
    getAddressbyKeypair (keypair) {
        const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoinNetwork})
        return pkh.address
    },

    hashtimelockcontract (hashx, redeemLockTimeStamp, destHash160Addr, revokerHash160Addr) {
        let redeemScript = bitcoin.script.compile([
            /* MAIN IF BRANCH */
            bitcoin.opcodes.OP_IF,
            bitcoin.opcodes.OP_SHA256,
            Buffer.from(hashx, 'hex'),
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            Buffer.from(hexTrip0x(destHash160Addr), 'hex'),//bitcoin.crypto.hash160(storeman.publicKey),
            //bitcoin.crypto.hash160(storeman.publicKey),
            bitcoin.opcodes.OP_ELSE,
            bitcoin.script.number.encode(redeemLockTimeStamp),
            bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
            bitcoin.opcodes.OP_DROP,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            Buffer.from(hexTrip0x(revokerHash160Addr), 'hex'),
            bitcoin.opcodes.OP_ENDIF,

            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG
        ])
        logger.debug('redeemScript:' + redeemScript.toString('hex'))

        let addressPay = bitcoin.payments.p2sh({
            redeem: {output: redeemScript, network: bitcoinNetwork},
            network: bitcoinNetwork
        })
        let address = addressPay.address

        return {
            'p2sh': address,
            'hashx': hashx,
            'redeemLockTimeStamp': redeemLockTimeStamp,
            'redeemScript': redeemScript
        }

    },

    selectUtxoTest (utxos, value) {
        let utxo
        for (let i = 0; i < utxos.length; i++) {
            if (utxos[i].value >= value) {
                utxo = utxos[i]
                console.log('find utxo:', utxo)
                return utxo
            }
        }
        console.log('can\'t find')
        return null
    },
    async decryptedWIF (encrypted, pwd) {
        let decryptedKey = await bip38.decrypt(encrypted, pwd)
        let privateKeyWif = await wif.encode(version, decryptedKey.privateKey, decryptedKey.compressed)

        return privateKeyWif
    },

    async getECPairs (passwd) {
        return this.getECPairsbyAddr(passwd)
    },
    async getECPairsbyAddr (passwd, addr) {
        let filter = {}
        if (addr) {filter.address = addr}

        let collection = this.getBtcWallet()
        let encryptedKeyResult = collection.find(filter)

        let ECPairArray = []
        try {
            for (let i = 0; i < encryptedKeyResult.length; i++) {
                let privateKeyWif = await this.decryptedWIF(encryptedKeyResult[i].encryptedKey, passwd)
                let alice = await bitcoin.ECPair.fromWIF(privateKeyWif, bitcoinNetwork)
                ECPairArray.push(alice)
            }
            if (addr) {
                return ECPairArray[0]
            } else {
                return ECPairArray
            }
        } catch (err) {
            if (err.code === 'ERR_ASSERTION') {
                logger.debug('password wrong!')
            } else {
                logger.debug('err: ', err)
            }

            return ECPairArray
        }
    },

    async getAddressList () {
        let collection = this.getBtcWallet()
        let btcAddressList = collection.find()
        return btcAddressList
    },

    async createAddress (passwd) {
        try {
            let btcAddress = this.getBtcWallet()
            let result = btcAddress.get(1)

            if (result) {
                let encryptedKey = result.encryptedKey
                await this.decryptedWIF(encryptedKey, passwd)
            }

            const keyPair = bitcoin.ECPair.makeRandom({
                network: bitcoinNetwork,
                rng: () => Buffer.from(crypto.randomBytes(32))
            })
            const {address} = await bitcoin.payments.p2pkh({pubkey: keyPair.publicKey, network: bitcoinNetwork})
            const privateKey = keyPair.toWIF()
            const decoded = wif.decode(privateKey, version)
            const encrypted = await bip38.encrypt(decoded.privateKey, decoded.compressed, passwd)

            let newAddress = {address: address, encryptedKey: encrypted}
            btcAddress.insert(newAddress)
            let t = await btcAddress.find({address: address})
            console.log('t: ', t)
            return newAddress
        } catch (err) {
            if (err.code === 'ERR_ASSERTION') {
                console.log('password wrong!')
            } else {
                console.log('err: ', err)
            }
            return null
        }
    },

    async removeAddress(addr, passwd) {
        let filter = {}
        if (addr) {filter.address = addr}

        let collection = this.getBtcWallet()
        let encryptedKeyResult = collection.find(filter)

        let ECPairArray = []
        try {
            for (let i = 0; i < encryptedKeyResult.length; i++) {
                let privateKeyWif = await this.decryptedWIF(encryptedKeyResult[i].encryptedKey, passwd)
                let alice = await bitcoin.ECPair.fromWIF(privateKeyWif, bitcoinNetwork)
                ECPairArray.push(alice)
            }

            if (ECPairArray.length === 0) {
                logger.debug('password wrong or no pair!')
                return;
            }

            await collection.remove(encryptedKeyResult);
        } catch (err) {
            if (err.code === 'ERR_ASSERTION') {
                logger.debug('password wrong!')
            } else {
                logger.debug('err: ', err)
                console.log(err);
            }
            return ECPairArray
        }
    },

    generatePrivateKey () {
        let randomBuf
        do {
            randomBuf = crypto.randomBytes(32)
        } while (!secp256k1.privateKeyVerify(randomBuf))
        return '0x' + randomBuf.toString('hex')
    },

    hash160ToAddress (hash160, addressType, network) {
        var address = new Address(binConv(hexTrip0x(hash160), {in: 'hex', out: 'bytes'}), addressType, network)
        return address.toString()
    },

    addressToHash160 (address, addressType, network) {  //'pubkeyhash','testnet'
        var address = new Address(address, addressType, network)
        return binConv(address.hash, {in: 'bytes', out: 'hex'})
    },
}

exports.btcUtil = btcUtil
