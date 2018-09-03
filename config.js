"use strict";

const bitcoin  = require('bitcoinjs-lib');
const path=require('path');

const config = {};
// config.socketUrl = 'ws://192.168.1.77:8080/';
config.socketUrl = 'wss://34.210.104.235';
var wanchainNet = 'testnet';
var ethereumNet = 'testnet';
//config.lockTime = 1000;
config.feeRate = 3000;
config.feeHard = 1000000;
config.bitcoinNetwork = bitcoin.networks.testnet;
config.bitcoinVersion = 0xef;


// config.dataName = wanchainNet;
//config.version = '1.0.0';
//config.host = 'http://localhost'; // http://localhost

if (process.platform === 'darwin') {
    config.rpcIpcPath = path.join(process.env.HOME, '/Library/Wanchain/'+wanchainNet+'gwan.ipc');
} else if (process.platform === 'freebsd' || process.platform === 'linux' || process.platform === 'sunos') {
    config.rpcIpcPath = path.join(process.env.HOME, '/.wanchain/'+wanchainNet+'gwan.ipc');
} else if (process.platform === 'win32') {
    config.rpcIpcPath = '\\\\.\\pipe\\gwan.ipc';
}

if (process.platform === 'darwin') {
    config.keyStorePath = path.join(process.env.HOME, '/Library/wanchain/'+wanchainNet+'keystore');
}else if (process.platform === 'freebsd' || process.platform === 'linux' || process.platform === 'sunos') {
    config.keyStorePath = path.join(process.env.HOME, '/.wanchain/'+wanchainNet+'keystore');
} else if(process.platform === 'win32') {
    config.keyStorePath = path.join(process.env.APPDATA, 'wanchain', wanchainNet, 'keystore');
}

if (process.platform === 'darwin') {
    config.ethkeyStorePath = path.join(process.env.HOME, '/Library/ethereum/'+ethereumNet+'keystore/');
}else if (process.platform === 'freebsd' || process.platform === 'linux' || process.platform === 'sunos') {
    config.ethkeyStorePath = path.join(process.env.HOME, '/.ethereum/'+ethereumNet+'keystore');
} else if(process.platform === 'win32') {
    config.ethkeyStorePath = path.join(process.env.APPDATA, 'ethereum', ethereumNet, 'keystore');
}

config.port = 8545;
config.useLocalNode = false;

config.loglevel = 'info';

config.listOption = true;
const Logger = require('./logger.js');
config.getLogger = function(name){
    return new Logger(name,"log.txt","error.txt",config.loglevel);
};


config.databasePath = process.env.HOME;
if (process.platform === 'win32') {
    config.databasePath = process.env.APPDATA;
}
config.databasePath =  path.join(config.databasePath, 'LocalDb');

config.wanKeyStorePath = config.keyStorePath;
config.ethKeyStorePath = config.ethkeyStorePath;

config.ethGasPrice = 123;
config.wanGasPrice = 123;
config.ethLockGas = 230000; //171866;
config.ethRefundGas = 120000;  // 91663;
config.ethRevokeGas = 60000; // 40323;

config.wanLockGas = 300000; // 232665;
config.wanRefundGas = 120000; // 34881;
config.wanRevokeGas = 80000; // 49917;

config.wanchainHtlcAddr = "0x4bbc39d425fff5aad40fc1c5c7287382ec52a13c";
config.WBTCToken = "0x01322d7ff75db8ba52c56831ee7f5e76a75b6051";

config.depositBtcCrossLockEvent = 'BTC2WBTCLock';
config.depositRedeemEvent = 'BTC2WBTCRefund';
config.withdrawBtcRevokeEvent = 'WBTC2BTCRevoke';
//btc
config.depositBtcLockNoticeEvent = 'BTC2WBTCLockNotice';
config.withdrawBtcRedeemNoticeEvent = 'WBTC2BTCLockNotice';


config.withdrawBtcCrossLockEvent = 'WBTC2BTCLockNotice';




config.crossDbname = 'crossTransDb';
config.crossCollection = 'btcCrossTransaction';
config.confirmBlocks = 3;
config.btcConfirmBlocks = 1;

config.HTLCWBTCInstAbi=[{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashShadow","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"RATIO_PRECISE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"wbtcManager","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"BTC_INDEX","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashHTLCTxs","outputs":[{"name":"direction","type":"uint8"},{"name":"source","type":"address"},{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"status","type":"uint8"},{"name":"lockedTime","type":"uint256"},{"name":"beginLockedTime","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"DEF_LOCKED_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"storemanGroupAdmin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"xHashExist","outputs":[{"name":"exist","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lockedTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"revokeFeeRatio","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"getHTLCLeftLockedTime","outputs":[{"name":"time","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"EMPTY_BYTE32","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"halted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHash2BtcLockedNotice","outputs":[{"name":"stmWanAddr","type":"address"},{"name":"userWanAddr","type":"address"},{"name":"userBtcAddr","type":"address"},{"name":"txHash","type":"bytes32"},{"name":"lockedTimestamp","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"DEF_MAX_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"coinAdmin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"ratio","type":"uint256"}],"name":"setRevokeFeeRatio","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"time","type":"uint256"}],"name":"setLockedTime","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"halt","type":"bool"}],"name":"setHalt","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"stmWanAddr","type":"address"},{"indexed":true,"name":"userWanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"txHash","type":"bytes32"},{"indexed":false,"name":"userBtcAddr","type":"address"},{"indexed":false,"name":"lockedTimestamp","type":"uint256"}],"name":"BTC2WBTCLockNotice","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"}],"name":"BTC2WBTCLock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"BTC2WBTCRefund","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"BTC2WBTCRevoke","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"userBtcAddr","type":"address"},{"indexed":false,"name":"fee","type":"uint256"}],"name":"WBTC2BTCLock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"stmBtcAddr","type":"address"},{"indexed":true,"name":"userBtcAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"txHash","type":"bytes32"},{"indexed":false,"name":"lockedTimestamp","type":"uint256"}],"name":"WBTC2BTCLockNotice","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"WBTC2BTCRefund","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"WBTC2BTCRevoke","type":"event"},{"constant":false,"inputs":[{"name":"addr","type":"address"}],"name":"setWBTCManager","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"smgAdminAddr","type":"address"},{"name":"coinAdminAddr","type":"address"}],"name":"setAdmin","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"stmWanAddr","type":"address"},{"name":"userBtcAddr","type":"address"},{"name":"xHash","type":"bytes32"},{"name":"txHash","type":"bytes32"},{"name":"lockedTimestamp","type":"uint256"}],"name":"btc2wbtcLockNotice","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"},{"name":"wanAddr","type":"address"},{"name":"value","type":"uint256"}],"name":"btc2wbtcLock","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"x","type":"bytes32"}],"name":"btc2wbtcRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"btc2wbtcRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"},{"name":"storeman","type":"address"},{"name":"btcAddr","type":"address"},{"name":"value","type":"uint256"}],"name":"wbtc2btcLock","outputs":[{"name":"","type":"bool"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"stmBtcAddr","type":"address"},{"name":"userWanAddr","type":"address"},{"name":"userBtcAddr","type":"address"},{"name":"xHash","type":"bytes32"},{"name":"txHash","type":"bytes32"},{"name":"lockedTimestamp","type":"uint256"}],"name":"wbtc2btcLockNotice","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"x","type":"bytes32"}],"name":"wbtc2btcRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"wbtc2btcRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"storeman","type":"address"},{"name":"value","type":"uint256"}],"name":"getWbtc2BtcFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}];

config.btcServer={
    regtest:{
        network: 'regtest',
        host: "118.190.33.66",
        port: 18443,
        username: "USER",
        password: "PASS"
    },
    testnet:{
        network: 'testnet',
        host: "18.237.186.227",
        port: 18332,
        username: "USER",
        password: "PASS"
    }
};

module.exports = config;
