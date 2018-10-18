'use strict';

var crypto = require('crypto');
var secp256k1 = require('secp256k1');
const pu = require('promisefy-util');
const wanUtil = require("wanchain-util");
const Client = require('bitcoin-core');
const bitcoin = require('bitcoinjs-lib');
const btcUtil = require('./btcUtil').btcUtil;
const cm = require('./comm.js');
const fs = require('fs');
const path = require('path');

let client;
const keythereum = require("keythereum");
keythereum.constants.quiet = true;
let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
let SendFromWeb3 = require("./wanchainsender/index.js").SendFromWeb3;
let sendTransaction = require('./cross_send/sendTransaction.js');
let btcWanTxSendRec = require('./cross_send/btcWanTxSendRec.js');

let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
let keystoreDir = require('wanchain-keystore').keystoreDir;
let logger;
let config;
const WebSocket = require('ws');
const Web3 = require("web3");
const web3 = new Web3();


const Backend = {
    CreaterSockSenderByChain(ChainType) {
        return new sendFromSocket(new socketServer(config.socketUrl, messageFactory), ChainType);
    },
    keyPairArray2AddrArray(kps) {
        let addrs = [];
        for (let i = 0; i < kps.length; i++) {
            addrs.push(this.getAddress(kps[i]));
        }
        return addrs;
    },
    async createrSocketSender(ChainType) {
        let sender = this.CreaterSockSenderByChain(ChainType);
        await pu.promiseEvent(this.CreaterSockSenderByChain, [ChainType], sender.socket.connection, "open");
        return sender;
    },
    async storemanInit(cfg) {
        config = cfg ? cfg : cm.config;
        this.config = config;
        this.client = new Client(config.btcServerNet);
        client = this.client;
        logger = config.getLogger("crossChainUtil");
        btcUtil.init();

        cm.lockedTime = config.lockedTime;
        logger.debug("lockedTime: ", cm.lockedTime);
    },
    updateLockedTime(seconds) {
        cm.lockedTime = seconds;
    },
    async init(cfg, ethsender, wansender, btcsender, cb) {
        config = cfg ? cfg : cm.config;
        this.config = config;
        this.client = new Client(config.btcServerNet);
        client = this.client;
        btcUtil.init();
        this.EthKeyStoreDir = new keystoreDir(config.ethKeyStorePath),
            this.WanKeyStoreDir = new keystoreDir(config.wanKeyStorePath),
            this.ethSender = ethsender;
        this.btcSender = btcsender;
        this.wanSender = wansender;
        if (config.useLocalNode && !this.web3Sender) {
            this.web3Sender = this.createrWeb3Sender(config.rpcIpcPath);
        }
        logger = config.getLogger("crossChainUtil");
        this.ethAddrs = Object.keys(this.EthKeyStoreDir.getAccounts());
        this.wanAddrs = Object.keys(this.WanKeyStoreDir.getAccounts());
        cm.lockedTime = await this.getWanLockTime(this.wanSender);
        logger.debug("lockedTime: ", cm.lockedTime);
        this.c2wRatio = await this.getBtcC2wRatio(this.wanSender);
        logger.debug("this.c2wRatio:", this.c2wRatio);
        if (cb) cb();
    },

    createTrans(sender) {
        return new sendTransaction(sender);
    },

    getCrossdbCollection() {
        return cm.crossDb.getCollection(cm.config.crossCollection);
    },
    async getSenderbyChain(chainType) {
        let sender;
        if (chainType == 'web3') {
            sender = this.web3Sender;
            return sender;
        }
        else if (chainType == 'ETH') {
            sender = this.ethSender;
            if (sender.socket.connection.readyState != WebSocket.OPEN) {
                sender = await  this.createrSocketSender("ETH");
                this.ethSender = sender;
            }
            return sender;
        }
        else if (chainType == 'BTC') {
            sender = this.ethSender;
            if (sender.socket.connection.readyState != WebSocket.OPEN) {
                sender = await  this.createrSocketSender("BTC");
                this.btcSender = sender;
            }
            return sender;
        }
        else if (chainType == 'WAN') {
            sender = this.wanSender;
            if (sender.socket.connection.readyState != WebSocket.OPEN) {
                sender = await  this.createrSocketSender("WAN");
                this.wanSender = sender;
            }
            return sender;
        }
    },
    async createrSender(ChainType, useWeb3 = false) {
        if (config.useLocalNode && ChainType == "WAN" && useWeb3) {
            return this.createrWeb3Sender(config.rpcIpcPath);
        } else {
            return await this.createrSocketSender(ChainType);
        }

    },
    createrWeb3Sender(url) {
        return new SendFromWeb3(url);
    },

    async getEthAccountsInfo(sender) {
        let bs;
        try {
            this.ethAddrs = Object.keys(this.EthKeyStoreDir.getAccounts());
            bs = await this.getMultiEthBalances(sender, this.ethAddrs);
        }
        catch (err) {
            logger.error("getEthAccountsInfo", err);
            return [];
        }
        let infos = [];
        for (let i = 0; i < this.ethAddrs.length; i++) {
            let info = {};
            info.balance = bs[this.ethAddrs[i]];
            info.address = this.ethAddrs[i];
            infos.push(info);
        }

        logger.debug("Eth Accounts infor: ", infos);
        return infos;
    },
    async getWanAccountsInfo(sender) {
        this.wanAddrs = Object.keys(this.WanKeyStoreDir.getAccounts());
        let bs = await this.getMultiWanBalances(sender, this.wanAddrs);
        let es = await this.getMultiTokenBalance(sender, this.wanAddrs);
        let infos = [];
        for (let i = 0; i < this.wanAddrs.length; i++) {
            let info = {};
            info.address = this.wanAddrs[i];
            info.balance = bs[this.wanAddrs[i]];
            info.wethBalance = es[this.wanAddrs[i]];
            infos.push(info);
        }

        logger.debug("Wan Accounts infor: ", infos);
        return infos;
    },

    getEthSmgList(sender) {
        let b = pu.promisefy(sender.sendMessage, ['syncStoremanGroups'], sender);
        return b;
    },
    getBtcSmgList(sender) {
        let b = pu.promisefy(sender.sendMessage, ['syncStoremanGroups'], sender);
        return b;
    },
    getTxReceipt(sender, txhash) {
        let bs = pu.promisefy(sender.sendMessage, ['getTransactionReceipt', txhash], sender);
        return bs;
    },
    getTxInfo(sender, txhash) {
        let bs = pu.promisefy(sender.sendMessage, ['getTxInfo', txhash], sender);
        return bs;
    },
    getBtcTransaction(sender, txhash) {
        let bs = pu.promisefy(sender.sendMessage, ['getBtcTransaction', txhash], sender);
        return bs;
    },
    getRawTransaction(sender, txhash) {
        return getTxInfo(sender, txhash);
    },
    createEthAddr(keyPassword) {
        let params = {keyBytes: 32, ivBytes: 16};
        let dk = keythereum.create(params);
        let options = {
            kdf: "scrypt",
            cipher: "aes-128-ctr",
            kdfparams: {
                n: 8192,
                dklen: 32,
                prf: "hmac-sha256"
            }
        };
        let keyObject = keythereum.dump(keyPassword, dk.privateKey, dk.salt, dk.iv, options);
        keythereum.exportToFile(keyObject, config.ethKeyStorePath);
        return keyObject.address;
    },
    createWanAddr(keyPassword) {
        let params = {keyBytes: 32, ivBytes: 16};
        let options = {
            kdf: "scrypt",
            cipher: "aes-128-ctr",
            kdfparams: {
                n: 8192,
                dklen: 32,
                prf: "hmac-sha256"
            }
        };
        let dk = keythereum.create(params);
        let keyObject = keythereum.dump(keyPassword, dk.privateKey, dk.salt, dk.iv, options);

        let dk2 = keythereum.create(params);
        let keyObject2 = keythereum.dump(keyPassword, dk2.privateKey, dk2.salt, dk2.iv, options);
        keyObject.crypto2 = keyObject2.crypto;

        keyObject.waddress = wanUtil.generateWaddrFromPriv(dk.privateKey, dk2.privateKey).slice(2);
        keythereum.exportToFile(keyObject, config.wanKeyStorePath);
        return keyObject.address;
    },
    getTxHistory(option) {
        this.collection = this.getCrossdbCollection();
        let Data = this.collection.find(option);
        let his = [];
        for (var i = 0; i < Data.length; ++i) {
            let Item = Data[i];
            his.push(Item);
        }
        return his;
    },
    async sendEthHash(sender, tx) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(tx.from, config.originalChainHtlc, tx.amount, tx.storemanGroup, tx.cross,
            tx.gas, tx.gasPrice, 'BTC2WBTC', tx.nonce);
        let txhash = await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendWanNotice(sender, tx) {
        let newTrans = this.createTrans(sender);
        newTrans.createDepositNotice(tx.from, tx.storeman, tx.userH160, tx.hashx, tx.txHash, tx.lockedTimestamp,
            tx.gas, tx.gasPrice);
        let txhash = await pu.promisefy(newTrans.sendNoticeTrans, [tx.passwd], newTrans);

        //to save to db
        tx.txhash = txhash
        this.btcWanNoticeSave(tx)

        return txhash;
    },
    async sendDepositX(sender, from, gas, gasPrice, x, passwd, nonce) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(from, config.wanchainHtlcAddr, null, null, null, gas, gasPrice, 'BTC2WBTC', nonce);
        newTrans.trans.setKey(x);
        let txhash = await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
        return txhash;
    },
    async sendEthCancel(sender, from, gas, gasPrice, x, passwd, nonce) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(from, config.originalChainHtlc, null, null, null, gas, gasPrice, 'BTC2WBTC', nonce);
        newTrans.trans.setKey(x);
        let txhash = await pu.promisefy(newTrans.sendRevokeTrans, [passwd], newTrans);
        return txhash;
    },
    getDepositWanNoticeEvent(sender, hashX) {
        let topics = [this.getEventHash(config.depositBtcLockNoticeEvent, config.HTLCWBTCInstAbi), null, null, hashX];
        let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return b;
    },
    getWithdrawRevokeEvent(sender, hashX) {
        let topics = [this.getEventHash(config.withdrawBtcRevokeEvent, config.HTLCWBTCInstAbi), null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },

    getWithdrawCrossLockEvent(sender, hashX) {
        let topics = [this.getEventHash(config.withdrawBtcCrossLockEvent, config.HTLCWBTCInstAbi), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getBtcWithdrawStoremanNoticeEvent(sender, hashX) {
        let topics = [this.getEventHash(config.withdrawBtcCrossLockEvent, config.HTLCWBTCInstAbi), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getDepositCrossLockEvent(sender, hashX) {
        let topics = [this.getEventHash(config.depositBtcCrossLockEvent, config.HTLCWBTCInstAbi), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getDepositRedeemEvent(sender, hashX) {
        let topics = [this.getEventHash(config.depositRedeemEvent, config.HTLCWBTCInstAbi), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getWithdrawBtcRedeemEvent(sender, hashX) {
        let topics = [this.getEventHash(config.withdrawBtcRedeemNoticeEvent, config.HTLCWBTCInstAbi), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositHTLCLeftLockedTime(sender, hashX) {
        let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.wanchainHtlcAddr, 'getHTLCLeftLockedTime', [hashX], config.HTLCWBTCInstAbi], sender);
        return p;
    },
    getWithdrawHTLCLeftLockedTime(sender, hashX) {
        let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.wanchainHtlcAddr, 'getHTLCLeftLockedTime', [hashX], config.HTLCWBTCInstAbi], sender);
        return p;
    },
    monitorTxConfirm(sender, txhash, waitBlocks) {
        let p = pu.promisefy(sender.sendMessage, ['getTransactionConfirm', txhash, waitBlocks], sender);
        return p;
    },
    getWanLockTime(sender) {
        let p = pu.promisefy(sender.sendMessage, ['getScVar', config.wanchainHtlcAddr, 'lockedTime', config.HTLCWBTCInstAbi], sender);
        return p;
    },
    getBtcC2wRatio(sender) {
        let p = pu.promisefy(sender.sendMessage, ['getCoin2WanRatio', 'BTC'], sender);
        return p;
    },
    _getBtcUtxo(sender, minconf, maxconf, addresses) {
        let p = pu.promisefy(sender.sendMessage, ['getUTXO', minconf, maxconf, addresses], sender);
        return p;
    },
    btcImportAddress(sender, address) {
        let p = pu.promisefy(sender.sendMessage, ['btcImportAddress', address], sender);
        return p;
    },
    async getP2shxByHashx(sender, hashx) {
        let p = pu.promisefy(sender.sendMessage, ['getP2shxByHashx', hashx], sender);
        return p;
    },
    async clientGetBtcUtxo(minconf, maxconf, addresses) {
        let utxos = await client.listUnspent(minconf, maxconf, addresses);
        utxos = utxos.map(function (item, index) {
            let av = item.value ? item.value : item.amount;
            item.value = Number(web3.toBigNumber(av).mul(100000000));
            item.amount = item.value;
            return item;
        });
        return utxos;
    },
    async getBtcUtxo(sender, minconf, maxconf, addresses) {
        let utxos = await this._getBtcUtxo(sender, minconf, maxconf, addresses);
        let utxos2 = utxos.map(function (item, index) {
            let av = item.value ? item.value : item.amount;
            item.value = Number(web3.toBigNumber(av).mul(100000000));
            item.amount = item.value;
            return item;
        });
        return utxos2;
    },
    generateP2shScript(p2shAddr) {
        let b1 = Buffer.from('a9', 'hex');
        let b2 = Buffer.from(p2shAddr, 'hex');
        let b3 = Buffer.from('87', 'hex');
        let b = Buffer.concat([b1, b2, b3]);
        return b;
    },

    async _verifyBtcUtxo(storemanAddr, txHash, hashx, lockedTimestamp, UserBtcAddr) { // utxo.amount
        try {
            let ctx = await client.getRawTransaction(txHash, true);
            logger.debug("verifyBtcUtxo ctx:", JSON.stringify(ctx));
            if (ctx && ctx.locktime == 0 && ctx.confirmations && ctx.confirmations >= config.btcConfirmBlocks) {
                let contract = btcUtil.hashtimelockcontract(hashx, lockedTimestamp, storemanAddr, UserBtcAddr); //(hashx, redeemLockTimeStamp,destHash160Addr, revokerHash160Addr)
                if (ctx.vout && ctx.vout[0] && ctx.vout[0].scriptPubKey.addresses[0] == contract.p2sh) {
                    return Number(web3.toBigNumber(ctx.vout[0].value).mul(100000000));  //Number(ctx.vout[0].value) * 100000000;
                }
            }
            return 0;
        } catch (err) {
            logger.error("verifyBtcUtxo: ", err);
            return 0;
        }
    },
    getEthBalance(sender, addr) {
        let bs = pu.promisefy(sender.sendMessage, ['getBalance', addr], sender);
        return bs;
    },
    getBlockByNumber(sender, blockNumber) {
        let bs = pu.promisefy(sender.sendMessage, ['getBlockByNumber', blockNumber], sender);
        return bs;
    },
    getBlockNumber(sender, blockNumber) {
        let bs = pu.promisefy(sender.sendMessage, ['getBlockNumber'], sender);
        return bs;
    },
    sendRawTransaction(sender, signedTx) {
        let bs = pu.promisefy(sender.sendMessage, ['sendRawTransaction', signedTx], sender);
        return bs;
    },
    saveNormalBtcTransactionInfo(txInfo) {
        let dbSaver = new btcWanTxSendRec();
        dbSaver.insertNormalData(txInfo);
    },
    btcSendRawTransaction(rawTx) {
        if (config.isStoreman) {
            return client.sendRawTransaction(rawTx);
        } else {
            return this.sendRawTransaction(this.btcSender, rawTx);
        }
    },
    getWanBalance(sender, addr) {
        let bs = pu.promisefy(sender.sendMessage, ['getBalance', addr], sender);
        return bs;
    },
    calculateLocWanFee(value, coin2WanRatio, txFeeRatio) {
        let wei = web3.toBigNumber(value);
        const DEFAULT_PRECISE = 10000;
        let fee = wei.mul(coin2WanRatio).mul(txFeeRatio).div(DEFAULT_PRECISE).div(DEFAULT_PRECISE).trunc();

        return '0x' + fee.toString(16);
    },
    async sendWanHash(sender, tx) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(tx.from, config.wanchainHtlcAddr, tx.amount, tx.storemanGroup, tx.cross,
            tx.gas, tx.gasPrice, 'WBTC2BTC', tx.nonce);
        if (tx.x) newTrans.trans.setKey(tx.x);
        newTrans.trans.setValue(tx.value);
        let txhash = await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendWanX(sender, from, gas, gasPrice, x, passwd, nonce) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(from, config.originalChainHtlc, null, null, null, gas, gasPrice, 'WBTC2BTC', nonce);
        newTrans.trans.setKey(x);
        let txhash = await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
        return txhash;
    },
    async sendWanCancel(sender, from, gas, gasPrice, hashx, passwd, nonce) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(from, config.wanchainHtlcAddr, null, null, null, gas, gasPrice, 'WBTC2BTC', nonce);
        newTrans.trans.setHashkey(hashx);
        let txhash = await pu.promisefy(newTrans.sendRevokeTrans, [passwd], newTrans);
        return txhash;
    },
    getMultiEthBalances(sender, addrs) {
        let bs = pu.promisefy(sender.sendMessage, ['getMultiBalances', addrs], sender);
        return bs;
    },
    getMultiWanBalances(sender, addrs) {
        let bs = pu.promisefy(sender.sendMessage, ['getMultiBalances', addrs], sender);
        return bs;
    },
    getMultiTokenBalance(sender, addrs) {
        let bs = pu.promisefy(sender.sendMessage, ['getMultiTokenBalance', addrs], sender);
        return bs;
    },
    getEventHash(eventName, contractAbi) {
        return '0x' + wanUtil.sha3(this.getcommandString(eventName, contractAbi)).toString('hex');
    },

    getcommandString(funcName, contractAbi) {
        for (var i = 0; i < contractAbi.length; ++i) {
            let item = contractAbi[i];
            if (item.name == funcName) {
                let command = funcName + '(';
                for (var j = 0; j < item.inputs.length; ++j) {
                    if (j != 0) {
                        command = command + ',';
                    }
                    command = command + item.inputs[j].type;
                }
                command = command + ')';
                return command;
            }
        }
    },
    updateStatus(key, Status) {
        let value = this.collection.findOne({HashX: key});
        if (value) {
            value.status = Status;
            this.collection.update(value);
        }
    },
    // user call this to lock btc
    async btc2wbtcLock(senderKp, ReceiverHash160Addr, value, hashx) {
        // generate script and p2sh address
        //let blocknum = await this.getBlockNumber(this.btcSender);
        //let redeemLockTimeStamp = blocknum + config.lockTime;
        let cur = Math.floor(Date.now() / 1000);
        let redeemLockTimeStamp = cur + Number(cm.lockedTime);
        let x;
        if (!hashx) {
            x = this.generatePrivateKey().slice(2); // hex string without 0x
            hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
            redeemLockTimeStamp = cur + 2 * Number(cm.lockedTime);// wallet need double.
        }
        let senderH160Addr = bitcoin.crypto.hash160(senderKp[0].publicKey).toString('hex');
        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, ReceiverHash160Addr, senderH160Addr);
        contract.x = x;
        let target = {
            address: contract['p2sh'],
            value: value
        };
        let sendResult;
        if (x) {
            sendResult = await this.btcTxBuildSendWallet(senderKp, target, config.feeRate);
        } else {
            //let utxos = await this.clientGetBtcUtxo(config.MIN_CONFIRM_BLKS, config.MAX_CONFIRM_BLKS, [config.storemanBtcAddr]);
            sendResult = await this.btcTxBuildSendStoreman(senderKp, target, config.feeRate);
        }

        contract.hashx = hashx;
        contract.redeemLockTimeStamp = redeemLockTimeStamp;
        contract.LockedTimestamp = redeemLockTimeStamp;
        contract.ReceiverHash160Addr = ReceiverHash160Addr;
        contract.senderH160Addr = senderH160Addr;
        contract.txhash = sendResult.result;
        contract.x = x;
        contract.value = value;
        contract.feeRate = config.feeRate;
        contract.fee = sendResult.fee;

        this.btcLockSave(contract);
        return contract;
    },

    async fund(senderKp, ReceiverHash160Addr, value) {
        // for wallet senderKp is array.
        return await this.btc2wbtcLock(senderKp, ReceiverHash160Addr, value, null);
    },
    async Storemanfund(senderKp, ReceiverHash160Addr, value, hashx) {
        return await this.btc2wbtcLock([senderKp], ReceiverHash160Addr, value, hashx);
    },
    // wallet api, use api server.
    async getUtxoValueByIdWallet(txid) {
        let rawTx = await this.getRawTransaction(this.btcSender, txid);
        let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'), config.bitcoinNetwork);
        return ctx.outs[0].value;
    },
    // wallet api, use client.
    async getUtxoValueByIdStoreman(txid) {
        let rawTx = await client.getRawTransaction(txid);
        let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'), config.bitcoinNetwork);
        return ctx.outs[0].value;
    },

    // when btc -- > wbtc, alice is revoker,  storeman is receiver.
    // when wbtc --> btc,  alice is receiver,  storeman is revoker.
    async revoke(hashx, redeemLockTimeStamp, receiverH160Addr, revokeKp, amount, txid, vout = 0) {

        let senderH160Addr = bitcoin.crypto.hash160(revokeKp.publicKey).toString('hex');
        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, receiverH160Addr, senderH160Addr);
        let redeemScript = contract['redeemScript'];

        let res = await this._revoke(hashx, txid, vout, amount, redeemScript, redeemLockTimeStamp, revokeKp);

        contract.txhash = res;
        contract.hashx = hashx;
        contract.redeemLockTimeStamp = redeemLockTimeStamp;
        contract.ReceiverHash160Addr = receiverH160Addr;
        contract.senderH160Addr = senderH160Addr;
        contract.value = amount;
        contract.feeRate = config.feeRate;
        contract.fee = config.feeHard;

        this.btcRevokeSave(contract);

        return res;

    },
    // when btc -- > wbtc, alice is revoker,  storeman is receiver.
    // when wbtc --> btc,  alice is receiver,  storeman is revoker.
    async revokeWithHashX(hashx, revokeKp) {

        let res = this.getBtcWanTxHistory({'HashX': hashx});
        let redeemLockTimeStamp = Number(res[0].btcRedeemLockTimeStamp) / 1000;
        let receiverH160Addr = res[0].storeman;
        let senderH160Addr = bitcoin.crypto.hash160(revokeKp.publicKey).toString('hex');

        let amount = res[0].txValue;
        let txid = res[0].btcLockTxHash;
        let vout = 0


        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, receiverH160Addr, senderH160Addr);
        let redeemScript = contract['redeemScript'];
        logger.debug("redeem redeemScript:", redeemScript);
        logger.debug("redeem redeemScript:", redeemScript);
        logger.debug("hashx=" + hashx);
        logger.debug("redeemLockTimeStamp=" + redeemLockTimeStamp);
        logger.debug("receiverH160Addr=" + receiverH160Addr);
        logger.debug("amount=" + amount);
        logger.debug("txid=" + txid);
        logger.debug("vout=" + vout);

        let txres = await this._revoke(hashx, txid, vout, amount, redeemScript, redeemLockTimeStamp, revokeKp);

        contract.txhash = txres;
        contract.hashx = hashx;
        contract.redeemLockTimeStamp = redeemLockTimeStamp;
        contract.ReceiverHash160Addr = receiverH160Addr;
        contract.senderH160Addr = senderH160Addr
        contract.value = amount;
        contract.feeRate = config.feeRate;
        contract.fee = config.feeHard;

        await this.btcRevokeSave(contract);

        return txres;

    },

    // call this function to revoke locked btc
    async _revoke(hashx, txid, vout, amount, redeemScript, redeemLockTimeStamp, revokerKeyPair) {
        let txb = new bitcoin.TransactionBuilder(config.bitcoinNetwork);
        txb.setLockTime(redeemLockTimeStamp);
        txb.setVersion(1);
        txb.addInput(txid, vout, 0);
        txb.addOutput(this.getAddress(revokerKeyPair), (amount - config.feeHard));

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

        let btcHash = this.btcSendRawTransaction(tx.toHex());
        logger.debug('_revoke result hash:', btcHash);
        return btcHash;
    },

    // when wbtc->btc,  storeman --> wallet.
    //storeman is sender.  wallet is receiverKp.
    // when btc->wbtc,  wallet --> storeman;
    // wallet is sender, storeman is receiver;
    async redeemWithHashX(hashx, receiverKp) {
        let res = this.getBtcWanTxHistory({'HashX': hashx});
        let redeemLockTimeStamp = Number(res[0].btcRedeemLockTimeStamp) / 1000;
        let senderH160Addr = res[0].StoremanBtcH160;

        logger.debug("senderH160Addr:", senderH160Addr);
        logger.debug("res:", res);
        let amount = res[0].value;
        let txid = res[0].btcLockTxHash;
        let vout = 0
        logger.debug("redeemWithHashX:", res);
        return this.redeem(res[0].x, hashx, redeemLockTimeStamp, senderH160Addr, receiverKp, amount, txid);
    },
    async redeem(x, hashx, redeemLockTimeStamp, senderH160Addr, receiverKp, value, txid) {

        let receiverHash160Addr = bitcoin.crypto.hash160(receiverKp.publicKey).toString('hex');
        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, receiverHash160Addr, senderH160Addr);
        let redeemScript = contract['redeemScript'];
        logger.debug("redeem redeemScript:", redeemScript);

        let res = await this._redeem(redeemScript, txid, x, receiverKp, value);

        contract.txhash = res;
        contract.hashx = hashx;
        contract.HashX = hashx;
        contract.redeemLockTimeStamp = redeemLockTimeStamp;
        contract.ReceiverHash160Addr = receiverHash160Addr;
        contract.senderH160Addr = senderH160Addr
        contract.x = x;
        contract.value = value;
        contract.feeRate = config.feeRate;
        contract.fee = config.feeHard;

        this.btcRedeemSave(contract);

        return res;
    },

    async _redeem(redeemScript, txid, x, receiverKp, value) {
        var txb = new bitcoin.TransactionBuilder(config.bitcoinNetwork);
        txb.setVersion(1);
        txb.addInput(txid, 0);
        txb.addOutput(btcUtil.getAddressbyKeypair(receiverKp), (value - config.feeHard));

        const tx = txb.buildIncomplete();
        const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);
        const redeemScriptSig = bitcoin.payments.p2sh({
            redeem: {
                input: bitcoin.script.compile([
                    bitcoin.script.signature.encode(receiverKp.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                    receiverKp.publicKey,
                    Buffer.from(x, 'hex'),
                    bitcoin.opcodes.OP_TRUE
                ]),
                output: redeemScript,
            },
            network: config.bitcoinNetwork
        }).input;
        tx.setInputScript(0, redeemScriptSig);

        let btcHash = await this.btcSendRawTransaction(tx.toHex());
        logger.debug("_redeem tx id:" + btcHash);
        return btcHash;
    },

    getUTXOSBalance(utxos) {
        let sum = 0
        let i = 0
        for (i = 0; i < utxos.length; i++) {
            sum += utxos[i].value
        }
        return sum
    },

    keysort(key, sortType) {
        return function (a, b) {
            return sortType ? ~~(a[key] < b[key]) : ~~(a[key] > b[key])
        }
    },

    getTxSize(vin, vout) {
        return vin * 180 + vout * 34 + 10 + vin
    },

    coinselect(utxos, target, feeRate) {
        let ninputs = 0
        let availableSat = 0
        let inputs = []
        let outputs = []
        let fee = 0

        utxos = utxos.sort(this.keysort('value', true))

        for (let i = 0; i < utxos.length; i++) {
            const utxo = utxos[i]
            if (utxo.confirmations >= config.MIN_CONFIRM_BLKS) {
                availableSat += Math.round(utxo.value)
                ninputs++
                inputs.push(utxo)
                fee = this.getTxSize(ninputs, 2) * feeRate
                if (availableSat >= target.value + fee) {
                    break
                }
            }
        }

        fee = this.getTxSize(ninputs, 2) * feeRate
        let change = availableSat - target.value - fee

        if (change < 0) {
            throw(new Error('balance can not offord fee and target tranfer value'));
        }

        outputs.push(target)
        outputs.push({'value': change})

        return {inputs, outputs, fee}
    },

    async btcBuildTransaction(utxos, keyPairArray, target, feeRate) {
        let addressArray = []
        let addressKeyMap = {}

        let i
        for (i = 0; i < keyPairArray.length; i++) {
            let kp = keyPairArray[i]
            let address = btcUtil.getAddressbyKeypair(kp)
            addressArray.push(address)
            addressKeyMap[address] = kp
        }
        let balance = this.getUTXOSBalance(utxos)
        if (balance <= target.value) {
            throw(new Error('utxo balance is not enough'));
        }

        let {inputs, outputs, fee} = this.coinselect(utxos, target, feeRate)

        // .inputs and .outputs will be undefined if no solution was found
        if (!inputs || !outputs) {
            throw(new Error('utxo balance is not enough'));
        }

        logger.debug('fee', fee)

        let txb = new bitcoin.TransactionBuilder(config.bitcoinNetwork);

        for (i = 0; i < inputs.length; i++) {
            let inItem = inputs[i]
            txb.addInput(inItem.txid, inItem.vout)
        }

        // put out at 0 position
        for (i = 0; i < outputs.length; i++) {
            let outItem = outputs[i]
            if (!outItem.address) {
                txb.addOutput(addressArray[0], Math.round(outItem.value))
            } else {
                txb.addOutput(outItem.address, Math.round(outItem.value))
            }
        }
        let rawTx;
            for (i = 0; i < inputs.length; i++) {
                let inItem = inputs[i]
                let from = inItem.address
                let signer = addressKeyMap[from]
                txb.sign(i, signer)
            }
            rawTx = txb.build().toHex()
        logger.debug('rawTx: ', rawTx)

        return {rawTx: rawTx, fee: fee};
    },
    async btcTxBuildSendWallet(keyPairArray, target, feeRate) {
        let utxos;
        let addArr = this.keyPairArray2AddrArray(keyPairArray);
        utxos = await this.getBtcUtxo(this.btcSender, config.MIN_CONFIRM_BLKS, config.MAX_CONFIRM_BLKS, addArr);
        const {rawTx, fee} = await this.btcBuildTransaction(utxos, keyPairArray, target, feeRate);
        if (!rawTx) {
            throw(new Error("no enough utxo."));
        }
        let result = await this.sendRawTransaction(this.btcSender, rawTx);
        return {result: result, fee: fee}
    },
    async btcTxBuildSendStoreman(keyPairArray, target, feeRate) {
        let utxos;
        let addArr = this.keyPairArray2AddrArray(keyPairArray);
        utxos = await this.clientGetBtcUtxo(config.MIN_CONFIRM_BLKS, config.MAX_CONFIRM_BLKS, addArr);

        const {rawTx, fee} = await this.btcBuildTransaction(utxos, keyPairArray, target, feeRate);
        if (!rawTx) {
            throw(new Error("no enough utxo."));
        }
        let result = await client.sendRawTransaction(rawTx);
        return {result: result, fee: fee}
    },


    async btcSendTransaction(keyPairArray, amount, destAddress, feeRate) {
        let target = {
            address: destAddress,
            value: Math.round(amount * 100000000)
        }

        return await this.btcTxBuildSend(keyPairArray, amount, target, feeRate)
    },


    redeemSriptCheck(sriptData) {
        try {
            const WHOLE_ITEM_LENGTH = 5;
            const REDEEM_SCRIPT_ITEM_LENGTH = 17;

            const XPOS = 2;
            const OP_TRUE_POS = 3;

            const FIXED_HASHX = '7eadc448515742a095d9e8cae09755e3e55ef3e3a08e4e84ce7d7ec5801cf510';
            const LOCK_SC_POS = 4;
            const FIXED_HASH_X_POS = 2;
            const FIXED_LK_TIME = 100;
            const FIXED_LK_TIME_POS = 8;
            const FIXED_DEST_HASH160 = '9a6b60f74a6bae176df05c3b0a118f85bab5c585';
            const FIXED_DEST_HASH160_POS = 6;
            const FIXED_REVOKER_HASH160 = '3533435f431a6a016ed0de73bd9645c8e2694416';
            const FIXED_REVOKER_HASH160_POS = 13;

            let contract = btcUtil.hashtimelockcontract(FIXED_HASHX, FIXED_LK_TIME, FIXED_DEST_HASH160, FIXED_REVOKER_HASH160);
            let fixedRedeemScript = contract['redeemScript'];
            logger.debug("fixed redeem script")

            //get the fixed script hash
            let fixedCmdData = bitcoin.script.compile(Buffer.from(fixedRedeemScript, 'hex'));
            let fixedCmd = bitcoin.script.toASM(fixedCmdData);

            let scInputs = bitcoin.script.compile(Buffer.from(sriptData, 'hex'));

            let lockSc = bitcoin.script.toASM(scInputs).split(' ');

            logger.debug(lockSc);

            let XX = lockSc[XPOS];
            if (lockSc.length != WHOLE_ITEM_LENGTH || XX.length != 64 || lockSc[OP_TRUE_POS] !== 'OP_1') {
                return new Error("wrong script or X length or OP code");
            }

            let scOutput = bitcoin.script.compile(Buffer.from(lockSc[LOCK_SC_POS], 'hex'));


            let gotRedeemScriptArray = bitcoin.script.toASM(scOutput).split(' ');
            if (gotRedeemScriptArray.length != REDEEM_SCRIPT_ITEM_LENGTH) {
                return new Error("wrong redeem script item number");
            }

            logger.debug(gotRedeemScriptArray);

            let gotHASHX = gotRedeemScriptArray[FIXED_HASH_X_POS];
            let gotLKTIME = gotRedeemScriptArray[FIXED_LK_TIME_POS];
            let gotDESTHASH160 = gotRedeemScriptArray[FIXED_DEST_HASH160_POS];
            let gotREVOKERHASH160 = gotRedeemScriptArray[FIXED_REVOKER_HASH160_POS];

            gotRedeemScriptArray[FIXED_HASH_X_POS] = FIXED_HASHX;
            gotRedeemScriptArray[FIXED_LK_TIME_POS] = FIXED_LK_TIME.toString(16);
            gotRedeemScriptArray[FIXED_DEST_HASH160_POS] = FIXED_DEST_HASH160;
            gotRedeemScriptArray[FIXED_REVOKER_HASH160_POS] = FIXED_REVOKER_HASH160;

            let changedRedeemScript = gotRedeemScriptArray.join(' ');

            if (fixedCmd == changedRedeemScript) {
                return {
                    'X': XX,
                    'HASHX': gotHASHX,
                    'LOCKTIME': gotLKTIME,
                    'DESTHASH160': gotDESTHASH160,
                    'REVOKERHASH160': gotREVOKERHASH160
                };
            } else {
                return new Error("wrong script hash");
            }

        } catch (e) {

            return e

        }

    },


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    getAddress(keypair) {
        let pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: config.bitcoinNetwork})
        return pkh.address
    },

    hexTrip0x(hexs) {
        if (0 == hexs.indexOf('0x')) {
            return hexs.slice(2);
        }
        return hexs;
    },

    getHashKey(key1) {
        //return BigNumber.random().toString(16);
        let key = this.hexTrip0x(key1);
        let hashKey = '0x' + bitcoin.crypto.sha256(Buffer.from(key, 'hex')).toString('hex');
        return hashKey;
    },

    generatePrivateKey() {
        let randomBuf;
        do {
            randomBuf = crypto.randomBytes(32);
        } while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    },

    getBtcWanTxHistory(option) {
        this.collection = this.getCrossdbCollection();
        let Data = this.collection.find(option);
        let his = [];
        for (var i = 0; i < Data.length; ++i) {
            let Item = Data[i];
            his.push(Item);
        }
        return his;
    },
    async reloadDb() {
        await cm.crossDb.loadDatabase();
    },

    formatInput(tx) {
        let ctx = {}
        ctx.from = this.hexTrip0x(btcUtil.hash160ToAddress(tx.senderH160Addr, 'pubkeyhash', 'testnet'));
        ctx.to = this.hexTrip0x(tx['p2sh'])
        ctx.value = tx.value
        ctx.amount = tx.value
        ctx.storeman = this.hexTrip0x(tx.ReceiverHash160Addr)

        if (tx.x != undefined) {
            ctx.x = this.hexTrip0x(tx.x)
        } else {
            ctx.x = ''
        }

        if (tx.hashx == undefined) {
            throw(new Error('hashx can not be undefined'));
        } else {
            ctx.hashx = this.hexTrip0x(tx.hashx)
            ctx.HashX = this.hexTrip0x(tx.hashx)
        }

        ctx.feeRate = config.feeRate
        ctx.fee = tx.fee
        ctx.crossType = 'BTC2WAN'
        ctx.redeemLockTimeStamp = tx.redeemLockTimeStamp

        return ctx
    },

    async btcLockSave(tx) {
        let newTrans = new btcWanTxSendRec()
        let ctx = this.formatInput(tx)

        if (tx.txhash != undefined) {
            ctx.lockTxHash = this.hexTrip0x(tx.txhash)
        }

        newTrans.insertLockData(ctx)
    },

    async btcRedeemSave(tx) {
        let newTrans = new btcWanTxSendRec()
        let ctx = this.formatInput(tx)

        if (ctx.error) {
            throw ctx.error;
        }

        if (tx.txhash != undefined) {
            ctx.refundTxHash = this.hexTrip0x(tx.txhash)
        } else {
            throw new Error("No refundTxHash");
        }

        newTrans.insertRefundData(ctx)
    },

    async btcRevokeSave(tx) {
        let newTrans = new btcWanTxSendRec()
        let ctx = this.formatInput(tx)

        if (ctx.error) {
            return
        }

        if (tx.txhash != undefined) {
            ctx.revokeTxHash = this.hexTrip0x(tx.txhash)
        }

        newTrans.insertRevokeData(ctx)
    },

    async btcWanNoticeSave(tx) {
        let newTrans = new btcWanTxSendRec()

        let ctx = {}
        ctx.hashx = this.hexTrip0x(tx.hashx);
        ctx.crossAddress = this.hexTrip0x(tx.from)
        ctx.btcNoticeTxhash = this.hexTrip0x(tx.txhash)
        ctx.crossType = "BTC2WAN";
        newTrans.insertWanNoticeData(ctx);
    },
      // addr has no '0x' already.
    getKsfullnamebyAddr(addr) {
        let addrl = addr.toLowerCase();
        let keystorePath = config.wanKeyStorePath;
        let files = fs.readdirSync(keystorePath);
        let i = 0;
        for (i = 0; i < files.length; i++) {
            if (files[i].toLowerCase().indexOf(addrl) != -1) {
                break;
            }
        }
        if (i == files.length) {
            return "";
        }
        return path.join(keystorePath, files[i]);
    },

    checkWanPassword(address, keyPassword) {
        if (address.indexOf('0x') == 0) {
            address = address.slice(2);
        }
        address = address.toLowerCase();
        let filepath = this.getKsfullnamebyAddr(address);
        if (!filepath) {
            return false;
        }

        let keystoreStr = fs.readFileSync(filepath, "utf8");
        let keystore = JSON.parse(keystoreStr);
        let keyBObj = { version: keystore.version, crypto: keystore.crypto2 };

        try {
            keythereum.recover(keyPassword, keyBObj);
            return true;
        } catch (error) {
            return false;
        }
    }
}

exports.Backend = Backend;
