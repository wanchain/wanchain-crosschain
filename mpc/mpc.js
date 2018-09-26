"use strict"

const config = require('../config.js');
const bitcoin = require('bitcoinjs-lib');

const Web3 = require("web3");
let  web3 = new Web3(new Web3.providers.HttpProvider(config.mpcRpc));
const web3Mpc = require("./web3Mpc.js");
web3Mpc.extend(web3);

function signMpcBtcTransaction(tx) {
    console.log("signMpcBtcTransaction tx:", tx);
    let mpcTx = {};
    mpcTx.Version = tx.version;
    mpcTx.LockTime = tx.locktime;
    mpcTx.From = '0x'+config.stmRipemd160Addr;
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
        let thash = new Buffer(tx.ins[i].hash.length);
        tx.ins[i].hash.copy(thash);
        sub.Hash = thash.reverse().toString('hex');
        sub.Index = tx.ins[i].index;
        o.PreviousOutPoint = sub;
        o.SignatureScript = '0x';//+tx.ins[i].script.toString('hex');
        o.Sequence = tx.ins[i].sequence;
        o.PkScript = '0x'+tx.ins[0].script.toString('hex');
        mpcTx.TxIn.push(o);
    }
    console.log("signMpcBtcTransaction mpcTx:", mpcTx);
    return new Promise((resolve, reject) => {
        try {
            web3.storeman.signMpcBtcTransaction(mpcTx, (err, result) => {
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

function addValidMpcBtcTx(tx) {
    return new Promise((resolve, reject) => {
        try {
            console.log(web3.storeman);
            web3.storeman.addValidMpcBtcTx(tx, (err, result) => {
                if (!err) {
                    console.log("********************************** mpc addValidMpcBtcTx successfully **********************************", result);
                    resolve(result);
                } else {
                    console.log("********************************** mpc addValidMpcBtcTx failed **********************************", err);
                    reject(err);
                }
            })
        } catch (err) {
            console.log("********************************** mpc addValidMpcBtcTx failed **********************************", err);
            reject(err);
        }
    });
}


module.exports.signMpcBtcTransaction = signMpcBtcTransaction;
module.exports.addValidMpcBtcTx = addValidMpcBtcTx;



