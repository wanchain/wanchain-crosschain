'use strict';

const pu = require('promisefy-util');
const bitcoin  = require('bitcoinjs-lib');
const wif = require('wif');
const bip38 = require('bip38');
const crypto = require('crypto');
const config = require('./config');
const lokiDbCollection = require('./wanchaindb/lib/lokiDbCollection');
const print4debug = console.log;
var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const secp256k1 = require("secp256k1");
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
var contractsMap = {};
var XXMap = {};

const FEE = 0.001
const MAX_CONFIRM_BLKS = 10000000;
const MIN_CONFIRM_BLKS = 0;
const LOCK_BLK_NUMBER = 10;

const network = bitcoin.networks.testnet;

const feeOptions = { minChange: 100, fee: 100 };
const feeRate = 55;


let bitcoinNetwork = config.bitcoinNetwork;
let version = config.bitcoinVersion;
function hexTrip0x(hexs){
    if(0 == hexs.indexOf('0x')){
        return hexs.slice(2);
    }
    return hexs;
}

const btcUtil = {
    createBtcAddr(){
        let Pair = bitcoin.ECPair.makeRandom({network:bitcoin.networks.testnet});
        let WIF = Pair.toWIF();
        let {address} = bitcoin.payments.p2pkh({pubkey: Pair.publicKey, network: bitcoin.networks.testnet});
        console.log("address: ", address);
        console.log("publicKey:", Pair.publicKey);
        console.log("hash160 PK:", bitcoin.crypto.hash160(Pair.publicKey).toString('hex'));
        console.log("WIF: ", WIF);
        return Pair;
        // todo save address to where?
    },

    getAddressbyKeypair(keypair) {
        const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
        return pkh.address;
    },

    hashtimelockcontract(hashx, redeemLockTimeStamp,destHash160Addr, revokerHash160Addr){
        let redeemScript = bitcoin.script.compile([
            /* MAIN IF BRANCH */
            bitcoin.opcodes.OP_IF,
            bitcoin.opcodes.OP_SHA256,
            Buffer.from(hashx, 'hex'),
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            Buffer.from(hexTrip0x(destHash160Addr), 'hex'),// wallet don't know storeman pubkey. //bitcoin.crypto.hash160(storeman.publicKey),//storeman.getPublicKeyBuffer(),// redeemer address
            //bitcoin.crypto.hash160(storeman.publicKey),
            bitcoin.opcodes.OP_ELSE,
            bitcoin.script.number.encode(redeemLockTimeStamp),
            bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
            bitcoin.opcodes.OP_DROP,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            Buffer.from(hexTrip0x(revokerHash160Addr), 'hex'),
            //bitcoin.crypto.hash160(alice.publicKey),//alice.getPublicKeyBuffer(), // funder addr
            /* ALMOST THE END. */
            bitcoin.opcodes.OP_ENDIF,

            // Complete the signature check.
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG
        ]);
        print4debug(redeemScript.toString('hex'));
        //var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
        //var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

        let addressPay = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: bitcoin.networks.testnet }, network: bitcoin.networks.testnet });
        let address = addressPay.address;

        return {
            'p2sh': address,
            'hashx': hashx,
            'redeemLockTimeStamp' : redeemLockTimeStamp,
            'redeemScript': redeemScript
        }

    },

    selectUtxoTest(utxos, value) {
        let utxo;
        for(let i=0; i<utxos.length; i++){
            if(utxos[i].value >= value){
                utxo = utxos[i];
                console.log("find utxo:", utxo);
                return utxo;
            }
        }
        console.log("can't find");
        return null;
    },
    async decryptedWIF(encrypted, pwd) {
        let decryptedKey = await bip38.decrypt(encrypted, pwd);
        let privateKeyWif = await wif.encode(version, decryptedKey.privateKey, decryptedKey.compressed);

        return privateKeyWif;
    },

    async getECPairs(passwd) {
        let encryptedKeyResult = await  lokiDbCollection.loadCollection('btcAddress').then(async btcAddress =>{
            let encryptedKeyResult = btcAddress.find();
            lokiDbCollection.btcDb.close();
            return encryptedKeyResult;
        });
        // print4debug('encryptedKeyResult: ', encryptedKeyResult);

        let ECPairArray = [];
        try {
            for(let i=0; i<encryptedKeyResult.length; i++){
                let privateKeyWif = await this.decryptedWIF(encryptedKeyResult[i].encryptedKey, passwd);
                let alice = await bitcoin.ECPair.fromWIF(privateKeyWif, bitcoinNetwork);
                ECPairArray.push(alice);
            }

            return ECPairArray;
        } catch (err) {
            if (err.code === 'ERR_ASSERTION') {
                print4debug('password wrong!');
            } else {
                print4debug('err: ', err);
            }

            return ECPairArray;
        }
    },

    async getAddressList() {
        return await  lokiDbCollection.loadCollection('btcAddress').then(async btcAddress =>{
            let btcAddressList = await btcAddress.find();
            lokiDbCollection.btcDb.close();

            return btcAddressList
        });
    },

    async createAddress(passwd) {
        return await lokiDbCollection.loadCollection('btcAddress').then(async btcAddress =>{
            try {
                let result = btcAddress.get(1);

                if (result) {
                    let encryptedKey = result.encryptedKey;
                    await this.decryptedWIF(encryptedKey, passwd);
                }

                const keyPair = bitcoin.ECPair.makeRandom({network: bitcoinNetwork, rng: () => Buffer.from(crypto.randomBytes(32))});
                const { address } = await bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: bitcoinNetwork });
                const privateKey = keyPair.toWIF();
                const decoded = wif.decode(privateKey, version);
                const encrypted = await bip38.encrypt( decoded.privateKey, decoded.compressed, passwd);

                let newAddress = {address: address, encryptedKey: encrypted};
                btcAddress.insert(newAddress);

                await lokiDbCollection.btcDb.save();

                // console.log('address: ', address);
                // console.log("Success: Do not share your password with anyone and keep it somewhere safe.")

                await lokiDbCollection.btcDb.close();

                return newAddress;
            } catch (err) {
                if (err.code === 'ERR_ASSERTION') {
                    console.log('password wrong!');
                } else {
                    console.log('err: ', err);
                }

                lokiDbCollection.btcDb.close();
                return null
            }
        });
    },
	
	generatePrivateKey(){
-        let randomBuf;
-        do{
-            randomBuf = crypto.randomBytes(32);
-        }while (!secp256k1.privateKeyVerify(randomBuf));
-        return '0x' + randomBuf.toString('hex');
-    }
}
 

exports.btcUtil = btcUtil;
