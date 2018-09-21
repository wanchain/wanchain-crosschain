"use strict"

const config = require('./config.js');

const Web3 = require("web3");
let  web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const storemanScriptSig = '0x'+bitcoin.script.compile([
    OPS.OP_DUP,
    OPS.OP_HASH160,
    config.stmRipemd160Addr,
    OPS.OP_EQUALVERIFY,
    OPS.OP_CHECKSIG
]).toString('hex');
const web3Mpc = require("mpc/web3Mpc.js");
web3Mpc.extend(web3);

    signMpcBtcTransaction(tx) {
        let mpcTx = {};
        mpcTx.Version = tx.version;
        mpcTx.LockTime = tx.locktime;
        mpcTx.From = config.stmRipemd160Addr;
        mpcTx.TxOut = [];
        for(let i=0; i<tx.outs.length; i++){
            let o = {};
            o.Value = tx.outs[i].value;
            o.PkScript = '0x'+tx.outs[i].script.toString('hex');
            mpcTx.TxOut.push(o);
        }
        mpcTx.TxIn = [];
        for(let i=0; i<tx.ins.length; i++) {
            let o = {};
            let sub = {};
            sub.Hash = '0x'+tx.ins[i].hash.toString('hex');
            sub.Index = tx.ins[i].index;
            o.PreviousOutPoint = sub;
            o.SignatureScript = '0x'+tx.ins[i].script.toString('hex');
            o.Sequence = tx.ins[i].sequence;
            o.PubKeyScrip = storemanScriptSig;
            mpcTx.TxIn.push(o);
        }

        return new Promise((resolve, reject) => {
            try {
                this.mpcWeb3.storeman.signMpcBtcTransaction(mpcTx, (err, result) => {
                    if (!err) {
                        console.log("********************************** mpc signViaMpc successfully **********************************", result);
                        resolve(result);

                    } else {
                        console.log("********************************** mpc signViaMpc failed **********************************", err);
                        reject(err);
                    }
                })
            } catch (err) {
                console.log("********************************** mpc signViaMpc failed **********************************", err);
                reject(err);
            }
        });
    }

    addValidMpcTxRaw() {
        return new Promise((resolve, reject) => {
            try {
                console.log(this.mpcWeb3.storeman);
                this.mpcWeb3.storeman.addValidMpcTxRaw(this.sendTxArgs, (err, result) => {
                    if (!err) {
                        console.log("********************************** mpc addValidMpcTxRawaddValidMpcTxRawaddValidMpcTxRaw successfully **********************************", result);
                        resolve(result);
                    } else {
                        console.log("********************************** mpc addValidMpcTxRawaddValidMpcTxRaw failed **********************************", err);
                        reject(err);
                    }
                })
            } catch (err) {
                console.log("********************************** mpc addValidMpcTxRaw failed **********************************", err);
                reject(err);
            }
        });
    }


module.exports.signMpcBtcTransaction = signMpcBtcTransaction;

