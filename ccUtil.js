'use strict'


const pu = require('promisefy-util');
let config = require('./config.js');
const BigNumber = require('bignumber.js');
const wanUtil = require("wanchain-util");
const keythereum = require("keythereum");
keythereum.constants.quiet = true;
let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
let SendFromWeb3 = require("./wanchainsender/index.js").SendFromWeb3;
let sendTransaction = require('./cross_send/sendTransaction.js');

let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
let databaseGroup = require('./wanchaindb/index.js').databaseGroup;
let keystoreDir = require('wanchain-keystore').keystoreDir;
const logger = config.logDebug.getLogger("crossChain util");
const WebSocket = require('ws');
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

const Backend = {
    CreaterSockSenderByChain(ChainType) {
            return new sendFromSocket(new socketServer(config.socketUrl,messageFactory),ChainType);
    },
    async createrSocketSender(ChainType){
        let sender =  this.CreaterSockSenderByChain(ChainType);
        await pu.promiseEvent(this.CreaterSockSenderByChain, [ChainType], sender.socket.connection, "open");
        return sender;
    },

    toGweiString(swei){
        let exp = new BigNumber(10);
        let wei = new BigNumber(swei);
        let gwei = wei.dividedBy(exp.pow(9));
        return  gwei.toString(10);
    },
    EthKeyStoreDir: new keystoreDir(config.ethKeyStorePath),
    WanKeyStoreDir: new keystoreDir(config.wanKeyStorePath),

    async init(cfg,ethsender, wansender,cb){
        config = cfg? cfg:config;
        this.ethSender = ethsender;
        this.wanSender = wansender;
        if(config.useLocalNode && !this.web3Sender){
            this.web3Sender =  this.createrWeb3Sender(config.rpcIpcPath);
        }

        this.ethAddrs  = Object.keys(this.EthKeyStoreDir.getAccounts());
        this.wanAddrs  = Object.keys(this.WanKeyStoreDir.getAccounts());
        global.lockedTime = await this.getEthLockTime(this.ethSender);
        global.w2cRatio = await this.getEthW2cRatio(this.ethSender);
        if(cb)cb();
    },

    createSender(sender){
        return new sendTransaction(sender);
    },

    getCollection(dbName,collectionName){
        return databaseGroup.getCollection(dbName,collectionName);
    },

    async getSenderbyChain(chainType){
        let sender;
        if(chainType == 'web3'){
            sender = this.web3Sender;
            return sender;
        }
        else if(chainType == 'ETH'){
            sender = this.ethSender;
            if(sender.socket.connection.readyState != WebSocket.OPEN) {
                sender = await  this.createrSocketSender("ETH");
                this.ethSender = sender;
            }
            return sender;
        }
        else if(chainType == 'WAN'){
            sender = this.wanSender;
            if(sender.socket.connection.readyState != WebSocket.OPEN) {
                sender = await  this.createrSocketSender("WAN");
                this.wanSender = sender;
            }
            return sender;
        }
    },
    async createrSender(ChainType, useWeb3=false){
        if(config.useLocalNode && ChainType=="WAN" && useWeb3){
            return this.createrWeb3Sender(config.rpcIpcPath);
        }else{
            return await this.createrSocketSender(ChainType);
        }

    },
    createrWeb3Sender(url) {
        return new SendFromWeb3(url);
    },

    async getEthAccountsInfo(sender) {
        let bs;
        try {
            this.ethAddrs  = Object.keys(this.EthKeyStoreDir.getAccounts());
            bs = await this.getMultiEthBalances(sender,this.ethAddrs);
        }
        catch(err){
            logger.error("getEthAccountsInfo", err);
            return [];
        }
        let infos = [];
        for(let i=0; i<this.ethAddrs.length; i++){
            let info = {};
            info.balance = bs[this.ethAddrs[i]];
            info.address = this.ethAddrs[i];
            infos.push(info);
        }

        logger.debug("Eth Accounts infor: ", infos);
        return infos;
    },
    async getWanAccountsInfo(sender) {
        this.wanAddrs  = Object.keys(this.WanKeyStoreDir.getAccounts());
        let bs = await this.getMultiWanBalances(sender,this.wanAddrs);
        let es = await this.getMultiTokenBalance(sender,this.wanAddrs);
        let infos = [];
        for(let i=0; i<this.wanAddrs.length; i++){
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
    getTxReceipt(sender,txhash){
        let bs = pu.promisefy(sender.sendMessage, ['getTransactionReceipt',txhash], sender);
        return bs;
    },

    createEthAddr(keyPassword){
        let params = { keyBytes: 32, ivBytes: 16 };
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
        keythereum.exportToFile(keyObject,config.ethKeyStorePath);
        return keyObject.address;
    },
    createWanAddr(keyPassword) {
        let params = { keyBytes: 32, ivBytes: 16 };
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
        //if(! this.collection){
            this.collection = this.getCollection(config.crossDbname,config.crossCollection);
        //}
        let Data = this.collection.find(option);
        let his = [];
        for(var i=0;i<Data.length;++i){
            let Item = Data[i];
            his.push(Item);
        }
        return his;
    },
    async sendEthHash(sender, tx) {
        let newTrans = this.createSender(sender);
        newTrans.createTransaction(tx.from, config.originalChainHtlc,tx.amount.toString(),tx.storemanGroup,tx.cross,tx.gas,this.toGweiString(tx.gasPrice.toString()),'ETH2WETH',tx.nonce);
        let txhash =  await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendDepositX(sender, from,gas,gasPrice,x, passwd, nonce) {
        let newTrans = this.createSender(sender);
        newTrans.createTransaction(from, config.wanchainHtlcAddr,null,null,null,gas,this.toGweiString(gasPrice),'ETH2WETH', nonce);
        newTrans.trans.setKey(x);
        let txhash =  await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
        return txhash;
    },
    async sendEthCancel(sender, from,gas,gasPrice,x, passwd, nonce) {
        let newTrans = this.createSender(sender);
        newTrans.createTransaction(from, config.originalChainHtlc,null,null,null,gas,this.toGweiString(gasPrice),'ETH2WETH', nonce);
        newTrans.trans.setKey(x);
        let txhash =  await pu.promisefy(newTrans.sendRevokeTrans, [passwd], newTrans);
        return txhash;
    },
    getDepositOrigenLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositOriginLockEvent).toString('hex'), null, null, hashX];
        let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return b;
    },
    getWithdrawOrigenLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawOriginLockEvent).toString('hex'), null, null, hashX];
        let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return b;
    },
    getWithdrawCrossLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawCrossLockEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositCrossLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositCrossLockEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getDepositOriginRefundEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositOriginRefundEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getWithdrawOriginRefundEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawOriginRefundEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositethRevokeEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.ethRevokeEvent).toString('hex'), null,  hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositHTLCLeftLockedTime(sender, hashX){
        let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.originalChainHtlc, 'getHTLCLeftLockedTime',[hashX],config.HTLCETHInstAbi], sender);
        return p;
    },
    getWithdrawHTLCLeftLockedTime(sender, hashX){
        let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.wanchainHtlcAddr, 'getHTLCLeftLockedTime',[hashX],config.HTLCWETHInstAbi], sender);
        return p;
    },
    monitorTxConfirm(sender, txhash, waitBlocks) {
        let p = pu.promisefy(sender.sendMessage, ['getTransactionConfirm', txhash, waitBlocks], sender);
        return p;
    },
    getEthLockTime(sender){
        let p = pu.promisefy(sender.sendMessage, ['getScVar', config.originalChainHtlc, 'lockedTime',config.HTLCETHInstAbi], sender);
        return p;
    },
    getEthW2cRatio(sender){
        let p = pu.promisefy(sender.sendMessage, ['getWan2CoinRatio','ETH'], sender);
        return p;
    },
    getEthBalance(sender, addr) {
        let bs = pu.promisefy(sender.sendMessage, ['getBalance',addr], sender);
        return bs;
    },
    getWanBalance(sender, addr) {
        let bs = pu.promisefy(sender.sendMessage, ['getBalance',addr], sender);
        return bs;
    },
    getEthBalancesSlow(sender, adds) {
        let ps = [];

        // TODO: only support one request one time.
        for(let i=0; i<adds.length; i++) {
            let b = pu.promisefy(sender.sendMessage, ['getBalance',adds[i]], sender);
            ps.push(b);
        }
        return ps;
    },
    caculateWithdrawFee(value){
        let exp = new BigNumber(10);
        let v = new BigNumber(value);
        let wei = v.mul(exp.pow(18));

        const wan2CoinRatio = global.w2cRatio;
        const txFeeratio = 1;
        let fee = wei * wan2CoinRatio * txFeeratio / 1000 / 1000;
        return fee;
    },
    async sendWanHash(sender, tx) {
        let newTrans = this.createSender(sender);
        newTrans.createTransaction(tx.from, config.wanchainHtlcAddr, tx.amount.toString(),tx.storemanGroup,tx.cross,tx.gas,this.toGweiString(tx.gasPrice.toString()),'WETH2ETH',tx.nonce);
        let txValue;
        if(!tx.value){
            txValue = this.caculateWithdrawFee(tx.amount);
        }else{
            txValue = web3.toWei(tx.value)
        }
        newTrans.trans.setValue(txValue);
        let txhash =  await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendWanX(sender, from,gas,gasPrice,x, passwd, nonce) {
        let newTrans = this.createSender(sender);
        newTrans.createTransaction( from, config.originalChainHtlc,null,null,null,gas,this.toGweiString(gasPrice),'WETH2ETH',nonce);
        newTrans.trans.setKey(x);
        let txhash =  await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
        return txhash;
    },
    async sendWanCancel(sender, from,gas,gasPrice,x, passwd,nonce) {
        let newTrans = this.createSender(sender);
        newTrans.createTransaction( from, config.wanchainHtlcAddr,null,null,null,gas,this.toGweiString(gasPrice),'WETH2ETH',nonce);
        newTrans.trans.setKey(x);
        let txhash =  await pu.promisefy(newTrans.sendRevokeTrans, [passwd], newTrans);
        return txhash;
    },
    getMultiEthBalances(sender, addrs) {
        let bs = pu.promisefy(sender.sendMessage, ['getMultiBalances',addrs], sender);
        return bs;
    },
    getMultiWanBalances(sender, addrs) {
        let bs = pu.promisefy(sender.sendMessage, ['getMultiBalances',addrs], sender);
        return bs;
    },
    getMultiTokenBalance(sender, addrs) {
        let bs = pu.promisefy(sender.sendMessage, ['getMultiTokenBalance',addrs], sender);
        return bs;
    },

    updateStatus(key, Status){
        let value = this.collection.findOne({HashX:key});
        if(value){
            value.status = Status;
            this.collection.update(value);
        }
    },

}

exports.Backend = Backend;
