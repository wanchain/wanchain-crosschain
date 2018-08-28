'use strict';

var Address = require('btc-address');
var binConv = require('binstring');
const bitcoin  = require('bitcoinjs-lib');
const wif = require('wif');
const bip38 = require('bip38');
const crypto = require('crypto');
//const cluster = require('cluster');
const config = require('./config');
const lokiDbCollection = require('./wanchaindb/lib/lokiDbCollection');
const print4debug = console.log;
const secp256k1 = require("secp256k1");

let bitcoinNetwork = config.bitcoinNetwork;
let version = config.bitcoinVersion;
function hexTrip0x(hexs){
    if(0 == hexs.indexOf('0x')){
        return hexs.slice(2);
    }
    return hexs;
}

const btcUtil = {
    getAddressbyKeypair(keypair) {
        const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoinNetwork});
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

        let addressPay = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: bitcoinNetwork }, network: bitcoinNetwork });
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
	async getECPairsbyAddr(passwd, addr) {
		let encryptedKeyResult = await  lokiDbCollection.loadCollection('btcAddress').then(async btcAddress =>{
			let encryptedKeyResult = btcAddress.find({address: addr});
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

			return ECPairArray[0];
		} catch (err) {
			if (err.code === 'ERR_ASSERTION') {
				print4debug('password wrong!');
			} else {
				print4debug('err: ', err);
			}

			return ECPairArray;
		}
	},
  // clusterGetECPairs(passwd) {
  //
  //   return new Promise((resolve, reject) => {
  //
  //     lokiDbCollection.loadCollection('btcAddress').then(async btcAddress =>{
  //       let encryptedKeyResult = await btcAddress.find();
  //       await lokiDbCollection.btcDb.close();
  //
  //       let array = [];
  //       try {
  //
  //         if (cluster.isMaster) {
  //           for (let j = 0; j < encryptedKeyResult.length; j++) {
  //             let worker = cluster.fork();
  //             worker.on('message', function(m) {
  //               array.push(m);
  //             });
  //           }
  //
  //           cluster.on('exit', function(worker, code, signal) {
  //             if(!--encryptedKeyResult.length){
  //               resolve(array);
  //             }
  //           });
  //
  //         } else {
  //           let privateKeyWif = await this.decryptedWIF(encryptedKeyResult[cluster.worker.id -1].encryptedKey, passwd);
  //           let alice = await bitcoin.ECPair.fromWIF(privateKeyWif, bitcoinNetwork);
  //           process.send(alice);
  //           process.exit(0);
  //         }
  //       } catch (err) {
  //         if (err.code === 'ERR_ASSERTION') {
  //           console.log('password wrong!');
  //         } else {
  //           console.log('err: ', err);
  //         }
  //         reject(array);
  //       }
  //     });
  //   })
  // },

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
        let randomBuf;
        do{
            randomBuf = crypto.randomBytes(32);
        }while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    },


  hash160ToAddress(hash160,addressType,network){
    var address = new Address(binConv(hexTrip0x(hash160), { in : 'hex', out: 'bytes'}),addressType,network);
    return address.toString();
  },

  addressToHash160(address,addressType,network){
    var address = new Address(address,addressType,network);
    return binConv(address.hash,{ in : 'bytes', out: 'hex'});
  },

}


exports.btcUtil = btcUtil;
