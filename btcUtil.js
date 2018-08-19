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
function addressTrip0x(addr){
    if(0 == addr.indexOf('0x')){
        console.log("????????????old addr: ", addr);
        console.log("????????????new addr: ", addr.slice(2));

        return addr.slice(2);
    }
    return addr;
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

            Buffer.from(addressTrip0x(destHash160Addr), 'hex'),// wallet don't know storeman pubkey. //bitcoin.crypto.hash160(storeman.publicKey),//storeman.getPublicKeyBuffer(),// redeemer address
            //bitcoin.crypto.hash160(storeman.publicKey),
            bitcoin.opcodes.OP_ELSE,
            bitcoin.script.number.encode(redeemLockTimeStamp),
            bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
            bitcoin.opcodes.OP_DROP,
            bitcoin.opcodes.OP_DUP,
            bitcoin.opcodes.OP_HASH160,

            Buffer.from(addressTrip0x(revokerHash160Addr), 'hex'),
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
            if(utxos[i].amount >= value){
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

    // init() {
    //     htlc = new Htlc();
    //     htlc.init();
    // },

    // getAddress(keypair){
    //     let pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
    //     return pkh.address;
    // },




    setKey(key){
        this.key = key;
        this.hashKey = this.getHashKey(this.key);
    },

    getHashKey(key){
        //return BigNumber.random().toString(16);

        let kBuf = new Buffer(key.slice(2), 'hex');
//        let hashKey = '0x' + util.sha256(kBuf);
        let h = createKeccakHash('keccak256');
        h.update(kBuf);
        let hashKey = '0x' + h.digest('hex');
        console.log('input key:', key);
        console.log('input hash key:', hashKey);
        return hashKey;

    },

    generatePrivateKey(){
        let randomBuf;
        do{
            randomBuf = crypto.randomBytes(32);
        }while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    },


    //user call this to lock btc
    async btc2wbtcLock(keyPairArray,amount,feeRate,destHash160) {

        let XX = this.generatePrivateKey();
        let hashX = this.getHashKey(XX);

        // generate script and p2sh address
        let revokerHash160 = bitcoin.crypto.hash160(keyPairArray[0].publicKey);

        let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);
        let contract = await this.hashtimelockcontract(hashX, blocknum+LOCK_BLK_NUMBER * 2, destHash160, revokerHash160);

        //record it in map
        let txId = await this.lock(contract,amount,keyPairArray,feeRate);

        if (txId != undefined) {
            //record it in map; TODO change to DB.
            contractsMap[txId] = contract;
            XXMap[txId] = XX;
            return {txId:txId,hashX:hashX,redeemblocknum:contract['redeemblocknum']};

        } else {

            return null;

        }

    },

    async wbtc2btcLock(keyPairArray,amount,feeRate,destPub) {

        let XX = this.generatePrivateKey();
        let hashX = this.getHashKey(XX);

        // generate script and p2sh address
        let contract = await this.hashtimelockcontract(hashX, LOCK_BLK_NUMBER, destPub, keyPairArray[0].pubkey);


        let txId = await this.lock(contract,amount,keyPairArray,feeRate);

        if (txId != undefined) {
            //record it in map
            contractsMap[txId] = contract;
            XXMap[txId] = XX;
            return {txId:txId,hashX:hashX,redeemblocknum:contract['redeemblocknum']};

        } else {

            return null;

        }
    },

    async btc2wbtcRefund(txHash,refunderKeyPair){

        let rawTx = ccUtil.getTxInfo(txHash);
        let XX = XXMap[txHash];

        return this.refund(rawTx,XX,refunderKeyPair);
    },

    async wbtc2btcrefund(txHash,refunderKeyPair){
        let XX = XXMap[txHash];
        let rawTx = ccUtil.getTxInfo(txHash);
        return this.refund(rawTx,XX,refunderKeyPair);
    },

    async btc2wbtcRevoke(txHash,revokerKeyPair){

        let hashX = this.getHashKey(XXMap[txHash])
        let rawTx = ccUtil.getTxInfo(txHash);

        return await this.revoke(rawTx,revokerKeyPair);
    },

    async wbtc2btcRevoke(txHash,revokerKeyPair){

        let rawTx = ccUtil.getTxInfo(txHash);
        return await this.revoke(rawTx,revokerKeyPair);
    },

    // async hashtimelockcontract(hashX, locktime,destHash160/*smg address*/,revokerHash160/**revoker address*/){
    //     let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);
    //
    //     console.log("blocknum:" + blocknum);
    //     console.log("Current blocknum on Bitcoin: " + blocknum);
    //     let redeemblocknum = blocknum + locktime;
    //     console.log("Redeemblocknum on Bitcoin: " + redeemblocknum);
    //
    //     let redeemScript = bitcoin.script.compile([
    //         /* MAIN IF BRANCH */
    //         bitcoin.opcodes.OP_IF,
    //         bitcoin.opcodes.OP_SHA256,
    //         Buffer.from(hashX, 'hex'),
    //         bitcoin.opcodes.OP_EQUALVERIFY,
    //         bitcoin.opcodes.OP_DUP,
    //         bitcoin.opcodes.OP_HASH160,
    //
    //         destHash160,//bob.getPublicKeyBuffer(),// redeemer address
    //
    //         bitcoin.opcodes.OP_ELSE,
    //         bitcoin.script.number.encode(redeemblocknum),
    //         bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
    //         bitcoin.opcodes.OP_DROP,
    //         bitcoin.opcodes.OP_DUP,
    //         bitcoin.opcodes.OP_HASH160,
    //
    //         revokerHash160,//alice.getPublicKeyBuffer(), // funder addr
    //
    //         /* ALMOST THE END. */
    //         bitcoin.opcodes.OP_ENDIF,
    //
    //         // Complete the signature check.
    //         bitcoin.opcodes.OP_EQUALVERIFY,
    //         bitcoin.opcodes.OP_CHECKSIG
    //     ]);
    //
    //
    //     console.log(redeemScript.toString('hex'));
    //     //var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
    //     //var address = bitcoin.address.fromOutputScript(scriptPubKey, network)
    //
    //     let addressPay = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: network }, network: network });
    //     let address = addressPay.address;
    //
    //     await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 100, [address]);
    //
    //     return {
    //         'p2sh': address,
    //         'redeemblocknum' : redeemblocknum,
    //         'redeemScript': redeemScript,
    //         'locktime': locktime
    //     }
    //
    // },


    async lock(contract,amount,keyPairArray,feeRate) {

        let addressArray = [];
        let addressKeyMap = {};

        //define target utxo
        let targets = [
            {
                address: contract['p2sh'],
                value: amount*100000000
            }
        ]

        let i;
        for (i = 0; i < keyPairArray.length; i++) {
            let kp = keyPairArray[i];
            let address = this.getAddress(kp);
            addressArray.push(address);
            addressKeyMap[address] = kp;
        }

        let utxos= await ccUtil.getBtcUtxo(ccUtil.btcSender, MIN_CONFIRM_BLKS, MAX_CONFIRM_BLKS, addressArray);

        utxos = utxos.map(function(item,index){
            item.value = item.amount * 100000000;
            return item;
        });

        let {inputs, outputs, fee} = coinselect.coinSelect(utxos,targets, feeRate);

        // .inputs and .outputs will be undefined if no solution was found
        if (!inputs || !outputs) {
            return;
        }

        console.log(fee);

        let txb = new bitcoin.TransactionBuilder(network);
        txb.setVersion(1);

        for (i = 0; i < inputs.length; i++) {
            let inItem = inputs[i];
            let from = inItem.address;
            let signer = addressKeyMap[from];
            txb.addInput(inItem.txid, inItem.vout);
        }


        //put p2sh at 0 position
        for (i = 0; i < outputs.length; i++) {
            let outItem = outputs[i];
            if (!outItem.address) {
                outItem.address = addressArray[0];
            }
            txb.addOutput(outItem.address, outItem.value);
        }

        for (i = 0; i < inputs.length; i++) {
            let inItem = inputs[i];
            let from = inItem.address;
            let signer = addressKeyMap[from];
            txb.sign(i, signer);
        }

        const rawTx = txb.build().toHex();
        console.log("rawTx: ", rawTx);

        let result = await ccUtil.sendRawTransaction(ccUtil.btcSender, rawTx);
        console.log("result hash:", result);

        return result;
    },



    // call this function to refund locked btc
    async refund(fundtx,XX,refunderKeyPair){
        //get the contract from buffer
        let contract = contractsMap[fundtx.vout.address];
        if(contract==undefined){
            return null
        }

        let redeemScript = contract['redeemScript'];

        let txb = new bitcoin.TransactionBuilder(network);
        txb.setVersion(1);

        print4debug('----W----A----N----C----H----A----I----N----');
        print4debug(JSON.stringify(fundtx))
        print4debug('----W----A----N----C----H----A----I----N----');

        txb.addInput(fundtx.txid, fundtx.vout);
        txb.addOutput(this.getAddress(refunderKeyPair), (fundtx.amount-FEE)*100000000);

        let tx = txb.buildIncomplete()
        let sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

        let redeemScriptSig = bitcoin.payments.p2sh({
            redeem: {
                input: bitcoin.script.compile([
                    bitcoin.script.signature.encode(refunderKeyPair.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                    refunderKeyPair.pubkey,
                    Buffer.from(XX, 'utf-8'),
                    bitcoin.opcodes.OP_TRUE
                ]),
                output: redeemScript,
            },
            network: network
        }).input;

        tx.setInputScript(0, redeemScriptSig);


        let rawTx = tx.toHex();
        print4debug("redeem raw tx: \n" + rawTx);
        let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
        console.log("result hash:", result);

        delete contractsMap[fundtx.vout.address];

        return result;
    },

    //call this function to revoke locked btc
    async revoke(fundtx,revokerKeyPair){

        let contract = contractsMap[fundtx.vout.address];
        if(contract==undefined){
            return null
        }

        let redeemScript = contract['redeemScript'];

        let txb = new bitcoin.TransactionBuilder(network);
        txb.setLockTime(contract['redeemblocknum']);
        txb.setVersion(1);
        txb.addInput(fundtx.txid, fundtx.vout, 0);
        txb.addOutput(this.getAddress(revokerKeyPair), (fundtx.amount-FEE)*100000000);

        let tx = txb.buildIncomplete();
        let sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

        let redeemScriptSig = bitcoin.payments.p2sh({
            redeem: {
                input: bitcoin.script.compile([
                    bitcoin.script.signature.encode(revokerKeyPair.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                    revokerKeyPair.publicKey,
                    bitcoin.opcodes.OP_FALSE
                ]),
                output: redeemScript
            }
        }).input;

        tx.setInputScript(0, redeemScriptSig);

        let rawTx = tx.toHex();
        print4debug("redeem raw tx: \n" + rawTx);
        let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
        console.log("result hash:", result);

        delete contractsMap[fundtx.vout.address];
        return result;
    }
};

exports.btcUtil = btcUtil;
