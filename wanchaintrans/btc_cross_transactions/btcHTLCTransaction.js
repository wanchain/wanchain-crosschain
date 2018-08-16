var bitcoin  = require('bitcoinjs-lib');
var config = require('../../config.js');
var utxo = require('./utxo/utxo.js');
var bip65 = require('bip65');

var ccUtil;
var btcUtil;
var contractsMap = {};

//FEE = 0.001
const MAX_CONFIRM_BLKS = 10000000;
const MIN_CONFIRM_BLKS = 0;
const LOCK_BLK_NUMBER = 10;
const feeRate = 55; // satoshis per byte

const network = bitcoin.networks.testnet;

class HTLCBTC  {

        getAddress(keypair){
            pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
            return pkh.address;
        }

        async init(){
            wanchainCore = new WanchainCore(config);
            ccUtil = wanchainCore.be;
            btcUtil = wanchainCore.btcUtil;
            await wanchainCore.init(config);
            console.log("start");
        }


        async hashtimelockcontract(hashX, locktime,destPub/*smg publickey*/,revokerPub/**revoker publickey*/){
            let blocknum = await ccUtil.getBlockNumber(ccUtil.btcSender);

            print4debug("blocknum:" + blocknum);
            print4debug("Current blocknum on Bitcoin: " + blocknum);
            let redeemblocknum = blocknum + locktime;
            print4debug("Redeemblocknum on Bitcoin: " + redeemblocknum);

            let redeemScript = bitcoin.script.compile([
                /* MAIN IF BRANCH */
                bitcoin.opcodes.OP_IF,
                bitcoin.opcodes.OP_SHA256,
                Buffer.from(hashX, 'hex'),
                bitcoin.opcodes.OP_EQUALVERIFY,
                bitcoin.opcodes.OP_DUP,
                bitcoin.opcodes.OP_HASH160,

                bitcoin.crypto.hash160(smgPub),//bob.getPublicKeyBuffer(),// redeemer address

                bitcoin.opcodes.OP_ELSE,
                bitcoin.script.number.encode(redeemblocknum),
                bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
                bitcoin.opcodes.OP_DROP,
                bitcoin.opcodes.OP_DUP,
                bitcoin.opcodes.OP_HASH160,

                bitcoin.crypto.hash160(revokerPub),//alice.getPublicKeyBuffer(), // funder addr

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

            await ccUtil.getBtcUtxo(ccUtil.btcSender, 1, 100, [address]);

            return {
                'p2sh': address,
                'redeemblocknum' : redeemblocknum,
                'redeemScript': redeemScript,
                'locktime': locktime
            }

        }


        async lock(contract,amount,keyPairArray,feeRate) {

            let addressArray = [];
            let addressKeyMap = {};

            //define target utxo
            let targets = [
                    {
                        address: contract['p2sh'],
                        value: amount
                    }
            ]



            for (kp in keyPairArray) {
                let address = getAddress(kp);
                addressArray.push(address);
                addressKeyMap[address] = kp;
            }

            let utxos = await ccUtil.getBtcUtxo(ccUtil.btcSender, MIN_CONFIRM_BLKS, MAX_CONFIRM_BLKS, addressArray);

            let {inputs, outputs, fee} = utxo.coinSelect(utxos, targets, feeRate);

            // .inputs and .outputs will be undefined if no solution was found
            if (!inputs || !outputs) {
                return;
            }

            console.log(fee);

            let txb = new bitcoin.TransactionBuilder(network);
            txb.setVersion(1)

            let i = 0;
            for (inItem in inputs) {
                from = inItem.vout.address;
                signer = addressKeyMap[from];

                txb.addInput(inItem.txId, inItem.vout);
                txb.sign(i++, signer);
            }

            for (outItem in outputs) {
                //change will be back to the sender
                if (!outItem.address) {
                    outItem.address = addressArray[0];
                }

                txb.addOutput(outItem.address, output.value);
            }

            const rawTx = txb.build().toHex();
            console.log("rawTx: ", rawTx);

            let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
            console.log("result hash:", result);

            return txid;
        }


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
            txb.addOutput(getAddress(refunderKeyPair), (fundtx.amount-FEE)*100000000);

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


            rawTx = tx.toHex();
            print4debug("redeem raw tx: \n" + rawTx);
            let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
            console.log("result hash:", result);

            delete contractsMap[fundtx.vout.address];

            return result;
        }

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
            txb.addOutput(getAddress(revokerKeyPair), (fundtx.amount-FEE)*100000000);

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

            rawTx = tx.toHex();
            print4debug("redeem raw tx: \n" + rawTx);
            let result = await ccUtil.sendRawTransaction(ccUtil.btcSender,rawTx);
            console.log("result hash:", result);

            delete contractsMap[fundtx.vout.address];
            return result;
        }


        //user call this to lock btc
        async btc2wbtcLock(amount,keyPairArray,feeRate,hashX,destPub) {
            // generate script and p2sh address
            let contract = await hashtimelockcontract(hashX, LOCK_BLK_NUMBER * 2, destPub, keyPairArray[0].pubkey);
            //record it in map
            contractsMap[contract['p2sh']] = contract;

            lock(contract,amount,keyPairArray,feeRate);
        }

        async wbtc2btcLock(amount,keyPairArray,feeRate,hashX,destPub) {
            // generate script and p2sh address
            let contract = await hashtimelockcontract(hashX, LOCK_BLK_NUMBER, destPub, keyPairArray[0].pubkey);
            //record it in map
            contractsMap[contract['p2sh']] = contract;

            lock(contract,amount,keyPairArray,feeRate);
        }

        async btc2wbtcRefund(fundtx,XX,refunderKeyPair){
            return refund(fundtx,XX,refunderKeyPair);
        }

        async wbtc2btcrefund(fundtx,XX,refunderKeyPair){
            return refund(fundtx,XX,refunderKeyPair);
        }

        async btc2wbtcRevoke(fundtx,revokerKeyPair){
            return revoke(fundtx,revokerKeyPair);
        }

        async wbtc2btcRevoke(fundtx,revokerKeyPair){
            return revoke(fundtx,revokerKeyPair);
        }
}

module.exports = global.HTLCBTC = HTLCBTC;


