"use strict"

const config = require('../config.js');
const bitcoin = require('bitcoinjs-lib');
const cm = require('./comm.js');

const Web3 = require("web3");
let  web3 = new Web3(new Web3.providers.HttpProvider(config.mpcRpc));
const web3Mpc = require("./web3Mpc.js");
web3Mpc.extend(web3);

function tx2mpcTx(tx){
    cm.logger.info("tx2mpcTx tx:", tx);
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
    return mpcTx;
}
function signMpcBtcTransaction(tx) {
    let mpcTx = tx2mpcTx(tx);
    cm.logger.info("signMpcBtcTransaction mpcTx:", mpcTx);
    return new Promise((resolve, reject) => {
        try {
            web3.storeman.signMpcBtcTransaction(mpcTx, (err, result) => {
                if (!err) {
                    cm.logger.info("********************************** mpc signViaMpc successfully **********************************", result);
                    resolve(result);

                } else {
                    cm.logger.info("********************************** mpc signViaMpc failed **********************************", err);
                    cm.logger.info("tx:", tx);
                    reject(err);
                }
            })
        } catch (err) {
            cm.logger.info("********************************** mpc signViaMpc failed **********************************", err);
            reject(err);
        }
    });
}

function addValidMpcBtcTx(tx) {
    let mpcTx = tx2mpcTx(tx);
    cm.logger.info("addValidMpcBtcTx mpcTx:", mpcTx);
    return new Promise((resolve, reject) => {
        try {
            cm.logger.info(web3.storeman);
            web3.storeman.addValidMpcBtcTx(mpcTx, (err, result) => {
                if (!err) {
                    cm.logger.info("********************************** mpc addValidMpcBtcTx successfully **********************************", result);
                    resolve(result);
                } else {
                    cm.logger.info("********************************** mpc addValidMpcBtcTx failed **********************************", err);
                    reject(err);
                }
            })
        } catch (err) {
            cm.logger.info("********************************** mpc addValidMpcBtcTx failed **********************************", err);
            reject(err);
        }
    });
}


module.exports.signMpcBtcTransaction = signMpcBtcTransaction;
module.exports.addValidMpcBtcTx = addValidMpcBtcTx;



