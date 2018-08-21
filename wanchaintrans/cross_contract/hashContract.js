"use strict";

const crypto = require('crypto');
const secp256k1 = require('secp256k1');
let IContract = require("../contract/IContract.js");
let CoinAmout = require("../interface/Amount.js").CoinAmount;
const createKeccakHash = require('keccak');
const cliConfig = require("../../../wanchain-crosschain-walletcli/config.js");
//let util = require('utility');

var ethAbi = [{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashShadow","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashHTLCTxs","outputs":[{"name":"source","type":"address"},{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"status","type":"uint8"},{"name":"lockedTime","type":"uint256"},{"name":"beginLockedTime","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"DEF_LOCKED_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"xHashExist","outputs":[{"name":"exist","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lockedTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"getHTLCLeftLockedTime","outputs":[{"name":"time","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"halted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"DEF_MAX_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"time","type":"uint256"}],"name":"setLockedTime","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"halt","type":"bool"}],"name":"setHalt","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"wanAddr","type":"address"}],"name":"ETH2WETHLock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"ETH2WETHRefund","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"ETH2WETHRevoke","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"}],"name":"WETH2ETHLock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"WETH2ETHRefund","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"WETH2ETHRevoke","type":"event"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"},{"name":"storeman","type":"address"},{"name":"wanAddr","type":"address"}],"name":"eth2wethLock","outputs":[{"name":"","type":"bool"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"x","type":"bytes32"}],"name":"eth2wethRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"eth2wethRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"},{"name":"user","type":"address"}],"name":"weth2ethLock","outputs":[{"name":"","type":"bool"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"x","type":"bytes32"}],"name":"weth2ethRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"weth2ethRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];
var wanAbi = [{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashShadow","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashHTLCTxs","outputs":[{"name":"source","type":"address"},{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"status","type":"uint8"},{"name":"lockedTime","type":"uint256"},{"name":"beginLockedTime","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"DEF_LOCKED_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"ETH_INDEX","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"storemanGroupAdmin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"bytes32"}],"name":"mapXHashFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"wethManager","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"xHashExist","outputs":[{"name":"exist","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lockedTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"getHTLCLeftLockedTime","outputs":[{"name":"time","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"halted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"DEF_MAX_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"time","type":"uint256"}],"name":"setLockedTime","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"halt","type":"bool"}],"name":"setHalt","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"}],"name":"ETH2WETHLock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"ETH2WETHRefund","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"ETH2WETHRevoke","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"ethAddr","type":"address"},{"indexed":false,"name":"fee","type":"uint256"}],"name":"WETH2ETHLock","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"WETH2ETHRefund","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"WETH2ETHRevoke","type":"event"},{"constant":false,"inputs":[{"name":"addr","type":"address"}],"name":"setWETHManager","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"addr","type":"address"}],"name":"setStoremanGroupAdmin","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"},{"name":"wanAddr","type":"address"},{"name":"value","type":"uint256"}],"name":"eth2wethLock","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"x","type":"bytes32"}],"name":"eth2wethRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"eth2wethRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"},{"name":"storeman","type":"address"},{"name":"ethAddr","type":"address"},{"name":"value","type":"uint256"}],"name":"weth2ethLock","outputs":[{"name":"","type":"bool"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"x","type":"bytes32"}],"name":"weth2ethRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"xHash","type":"bytes32"}],"name":"weth2ethRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"}];

let ETH2WETHfunc = ['eth2wethLock','eth2wethRefund','eth2wethRevoke','ETH2WETHLock'];
let WETH2ETHfunc = ['weth2ethLock','weth2ethRefund','weth2ethRevoke','WETH2ETHLock'];

// add by Jacob begin
var ethAbiE20 = [{"constant":true,"inputs":[],"name":"RATIO_PRECISE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"inboundRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenID","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"getHTLCLeftLockedTime","outputs":[{"name":"time","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"outboundRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"bytes32"}],"name":"mapXHashShadow","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"x","type":"bytes32"}],"name":"inboundRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"DEF_LOCKED_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"x","type":"bytes32"}],"name":"outboundRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"value","type":"uint256"},{"name":"xHash","type":"bytes32"},{"name":"storeman","type":"address"},{"name":"wanAddr","type":"address"}],"name":"inboundLock","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lockedTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"revokeFeeRatio","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"bytes32"}],"name":"mapXHashHTLCTxs","outputs":[{"name":"direction","type":"uint8"},{"name":"source","type":"address"},{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"status","type":"uint8"},{"name":"lockedTime","type":"uint256"},{"name":"beginLockedTime","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"halted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"mapTokenSupported","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"DEF_MAX_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"ratio","type":"uint256"}],"name":"setRevokeFeeRatio","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"tokenID","type":"address"}],"name":"addToken","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"time","type":"uint256"}],"name":"setLockedTime","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenID","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"xHashExist","outputs":[{"name":"exist","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"},{"name":"user","type":"address"}],"name":"outboundLock","outputs":[{"name":"","type":"bool"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"halt","type":"bool"}],"name":"setHalt","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"token","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"wanAddr","type":"address"}],"name":"InboundLockLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"token","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"InboundRefundLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"InboundRevokeLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"token","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"}],"name":"OutboundLockLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"token","type":"address"},{"indexed":true,"name":"user","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"OutboundRefundLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"OutboundRevokeLogger","type":"event"}];
var wanAbiE20 = [{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"},{"name":"wanAddr","type":"address"},{"name":"value","type":"uint256"}],"name":"inboundLock","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"RATIO_PRECISE","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"storemanGroup","type":"address"},{"name":"value","type":"uint256"}],"name":"getOutboundFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"tokenManager","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"inboundRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"quotaLedger","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"kill","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"},{"name":"storeman","type":"address"},{"name":"ethAddr","type":"address"},{"name":"value","type":"uint256"}],"name":"outboundLock","outputs":[{"name":"","type":"bool"}],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[{"name":"tokenID","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"getHTLCLeftLockedTime","outputs":[{"name":"time","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"outboundRevoke","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"bytes32"}],"name":"mapXHashShadow","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"x","type":"bytes32"}],"name":"inboundRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"DEF_LOCKED_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"addr","type":"address"}],"name":"setTokenManager","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"token","type":"address"},{"name":"x","type":"bytes32"}],"name":"outboundRefund","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"storemanGroupAdmin","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"addr","type":"address"}],"name":"setStoremanGroupAdmin","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"lockedTime","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"revokeFeeRatio","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"bytes32"}],"name":"mapXHashHTLCTxs","outputs":[{"name":"direction","type":"uint8"},{"name":"source","type":"address"},{"name":"destination","type":"address"},{"name":"value","type":"uint256"},{"name":"status","type":"uint8"},{"name":"lockedTime","type":"uint256"},{"name":"beginLockedTime","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"halted","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"mapTokenSupported","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"DEF_MAX_TIME","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"ratio","type":"uint256"}],"name":"setRevokeFeeRatio","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"tokenID","type":"address"}],"name":"addToken","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"time","type":"uint256"}],"name":"setLockedTime","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"},{"name":"","type":"bytes32"}],"name":"mapXHashFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"addr","type":"address"}],"name":"setQuotaLedger","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"tokenID","type":"address"},{"name":"xHash","type":"bytes32"}],"name":"xHashExist","outputs":[{"name":"exist","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"halt","type":"bool"}],"name":"setHalt","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":false,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"}],"name":"InboundLockLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":false,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"InboundRefundLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"InboundRevokeLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":false,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"value","type":"uint256"},{"indexed":false,"name":"ethAddr","type":"address"},{"indexed":false,"name":"fee","type":"uint256"}],"name":"OutboundLockLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"storeman","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":false,"name":"xHash","type":"bytes32"},{"indexed":false,"name":"x","type":"bytes32"}],"name":"OutboundRefundLogger","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"token","type":"address"},{"indexed":true,"name":"wanAddr","type":"address"},{"indexed":true,"name":"xHash","type":"bytes32"}],"name":"OutboundRevokeLogger","type":"event"}];
var orgAbiE20 = [{"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_from","type":"address"},{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"acceptOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_newOwner","type":"address"}],"name":"changeOwner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"newOwner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"user","type":"address"},{"name":"amount","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_from","type":"address"},{"indexed":true,"name":"_to","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_owner","type":"address"},{"indexed":true,"name":"_spender","type":"address"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"Approval","type":"event"}];

//let ETH2WETHfuncE20 = ['inboundLock','outboundRefund','outboundRevoke','InboundLockLogger'];
let ETH2WETHfuncE20 = ['inboundLock','inboundRefund','inboundRevoke','InboundLockLogger'];
let WETH2ETHfuncE20 = ['outboundLock','outboundRefund','outboundRevoke','OutboundLockLogger'];
let ORGFuncE20      = ['approve','','','Approval'];             // for approve

// add by Jacob end;
let logDebug;
module.exports = class hashContract extends IContract
{
    constructor(tokenAddress,storeman,crossAddress,crossType,ChainType,protocol="",opt="")
    {

        logDebug = global.getLogger('wanchainTrans');


          // let abi = ChainType == 'WAN' ? wanAbi : ethAbi;
          // if(crossType == 'ETH2WETH')
          //     super(abi,ETH2WETHfunc,tokenAddress);
          // else
          //     super(abi,WETH2ETHfunc,tokenAddress);
          let abi             = null;
          let contractFun     = null;
          if(ChainType === 'WAN'){
                if(protocol === 'E20'){
                    abi = wanAbiE20;
                }else{
                    abi = wanAbi;
                }
          }else{
                if(protocol === 'E20' && opt === 'APPROVE'){
                  abi = orgAbiE20;
                }else{
                    if(protocol === 'E20'){
                        abi = ethAbiE20;
                    }else{
                        abi = ethAbi;
                    }
                }
          }

      if(crossType == 'ETH2WETH'){
            if(protocol === 'E20' && opt === 'APPROVE'){
              contractFun = ORGFuncE20;
            }else{
              if(protocol === 'E20'){
                contractFun = ETH2WETHfuncE20;
              }else{
                contractFun = ETH2WETHfunc;
              }
            }
      }else{
            if(protocol === 'E20'){
              contractFun = WETH2ETHfuncE20;
            }else{
              contractFun = WETH2ETHfunc;
            }
      }

      super(abi,contractFun,tokenAddress);

      this.storeman = storeman;
      this.crossAddress = crossAddress;
      this.key = this.generatePrivateKey();
      this.hashKey = this.getHashKey(this.key);

      this.protocol = protocol;
      this.opt = opt;

      console.log("hashContract::constructor ",this.protocol+" "+this.opt);
    }
    setKey(key){
        this.key = key;
        this.hashKey = this.getHashKey(this.key);
    }
    getHashKey(key){
        //return BigNumber.random().toString(16);

        let kBuf = new Buffer(key.slice(2), 'hex');
//        let hashKey = '0x' + util.sha256(kBuf);
        let h = createKeccakHash('keccak256');
        h.update(kBuf);
        let hashKey = '0x' + h.digest('hex');
        logDebug.debug('input key:', key);
        logDebug.debug('input hash key:', hashKey);
        return hashKey;

    }
    generatePrivateKey(){
        let randomBuf;
        do{
            randomBuf = crypto.randomBytes(32);
        }while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    }
    getLockData(Amount)
    {
        console.log("hashContract:: getLockData",this.protocol+" "+this.opt);
        this.Amount = Amount;
      console.log("hashContract:: this.contractFunc ",this.contractFunc[0]);
        let funcInterface = this.getFuncInterface(this.contractFunc[0]);
        console.log("this.app_value :" ,this.app_value);
        let app_value = this.app_value;

        if(funcInterface)
        {
            logDebug.debug(this.hashKey,this.storeman,this.crossAddress);

            if(this.Amount){
              //return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress,this.Amount.getWei());
              // add by jacob begin.
              if (this.opt === 'APPROVE'){
                console.log(__filename,"getLockData","contractAddr:",this.contractAddr,"app_value:",app_value);
                //return funcInterface.getData('0x5801493999659d85549d70688fdc2616fbda4bf4',app_value.getWei());
                return funcInterface.getData(cliConfig.originalChainHtlcE20,app_value.getWei());
                //return funcInterface.getData(this.contractAddr,app_value.getWei());
              }else{
                return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress,this.Amount.getWei());
              }
              // add by jacob end.
            }
            else
            {
              // add by jacob begin
              if (this.opt === 'APPROVE'){
                console.log(__filename,"getLockData","contractAddr:",this.contractAddr,"app_value:",app_value);
                //return funcInterface.getData(this.contractAddr,app_value.getWei());
                //return funcInterface.getData('0x5801493999659d85549d70688fdc2616fbda4bf4',app_value.getWei());
                return funcInterface.getData(cliConfig.originalChainHtlcE20,app_value.getWei());
              } else{

                if(this.protocol === 'E20'){
                  console.log(__filename,"before funcInterface.getData");
                  console.log("this.E20_from ",this.E20_from);
                  console.log("app_value.getWei() ",app_value.getWei());
                  console.log("this.hashKey ",this.hashKey);
                  console.log("this.storeman ",this.storeman);
                  console.log("this.crossAddress ",this.crossAddress);
                  //return funcInterface.getData(this.E20_from,app_value.getWei(),this.hashKey,this.storeman,this.crossAddress);
                  // Jacob ,should be tocken address, HTLCETC address
                  //return funcInterface.getData(this.E20_from,app_value.getWei(),this.hashKey,this.storeman,this.crossAddress);
                  //return funcInterface.getData('0xb4f9d9aea2c53d37c96daad218c4b0edc5cfb136',app_value.getWei(),this.hashKey,this.storeman,this.crossAddress);
                  return funcInterface.getData(cliConfig.orgChainAddrE20,app_value.getWei(),this.hashKey,this.storeman,this.crossAddress);
                }else{
                  return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress);
                }

              }
              // add by jacob end
              //return funcInterface.getData(this.hashKey,this.storeman,this.crossAddress);
            }
        }
    }
    getRefundData(){
        console.log("hashContract::getRefundData contractFunc ",this.contractFunc[1]);
        let funcInterface = this.getFuncInterface(this.contractFunc[1]);
        if(funcInterface)
        {
          logDebug.debug('unlock data Key: ', this.key);
          //return funcInterface.getData(this.key);
            if(this.protocol !=='E20'){
              return funcInterface.getData(this.key);
            }else{
              console.log("cliConfig.orgChainAddrE20:",cliConfig.orgChainAddrE20);
              return funcInterface.getData(cliConfig.orgChainAddrE20,this.key);
            }

        }
    }
    getRevokeData(){
      console.log("hashContract::getRevokeData contractFunc ",this.contractFunc[2]);
        let funcInterface = this.getFuncInterface(this.contractFunc[2]);
        if(funcInterface)
        {
            return funcInterface.getData(this.hashKey);
        }
    }
    getLockEvent(){
        return [this.getEventCode(this.contractFunc[3]),null,null,this.hashKey];
    }
}
