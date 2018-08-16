'use strict';


const bitcoin  = require('bitcoinjs-lib');
const print4debug = console.log;

const btcUtil = {
    createBtcAddr(){
        let Pair = bitcoin.ECPair.makeRandom({network:bitcoin.networks.testnet});
        let WIF = Pair.toWIF();
        let {address} = bitcoin.payments.p2pkh({pubkey: Pair.publicKey, network: bitcoin.networks.testnet});
        console.log("address: ", address);
        console.log("publicKey:", Pair.publicKey);
        console.log("hash160 PK:", bitcoin.crypto.hash160(Pair.publicKey).toString('hex'));
        console.log("WIF: ", WIF);
        // todo save address to where?
    },
    getAddressbyKeypair(keypair) {
        const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
        return pkh.address;
    },


    hashtimelockcontract(storemanHash160,xHash, redeemblocknum){
        let redeemScript = bitcoin.script.compile([
            /* MAIN IF BRANCH */
            bitcoin.opcodes.OP_IF,
            bitcoin.opcodes.OP_SHA256,
            Buffer.from(xHash, 'hex'),
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            storemanHash160,// wallet don't know storeman pubkey. //bitcoin.crypto.hash160(storeman.publicKey),//storeman.getPublicKeyBuffer(),// redeemer address
            //bitcoin.crypto.hash160(storeman.publicKey),
            bitcoin.opcodes.OP_ELSE,
            bitcoin.script.number.encode(redeemblocknum),
            bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
            bitcoin.opcodes.OP_DROP,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            bitcoin.crypto.hash160(alice.publicKey),//alice.getPublicKeyBuffer(), // funder addr
            /* ALMOST THE END. */
            bitcoin.opcodes.OP_ENDIF,

            // Complete the signature check.
            bitcoin.opcodes.OP_EQUALVERIFY,
            bitcoin.opcodes.OP_CHECKSIG
        ]);
        print4debug(redeemScript.toString('hex'));
        //var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
        //var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

        let addressPay = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: network }, network: network });
        let address = addressPay.address;

        return {
            'p2sh': address,
            'redeemblocknum' : redeemblocknum,
            'redeemScript': redeemScript
        }

    }
};

exports.btcUtil = btcUtil;