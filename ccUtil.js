'use strict'


const pu = require('promisefy-util');
const BigNumber = require('bignumber.js');
const wanUtil = require("wanchain-util");
const Client = require('bitcoin-core');
const bitcoin  = require('bitcoinjs-lib');
const btcUtil = require('./btcUtil').btcUtil;
const bs58check = require('bs58check');
const btcserver={
    regtest:{
        network: 'regtest',
        host: "18.237.186.227",
        port: 18443,
        username: "USER",
        password: "PASS"
    }
};
var alice = bitcoin.ECPair.fromWIF(
    'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const aliceHash160Addr = bitcoin.crypto.hash160(alice.publicKey).toString('hex');
const storemanWif = 'cQrhq6e1bWZ8YBqaPcg5Q8vwdhEwwq1RNsMmv2opPQ4fuW2u8HYn';
const storemanHash160Addr = "0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe";
var storeman = bitcoin.ECPair.fromWIF(
    storemanWif, bitcoin.networks.testnet
);
const client = new Client(btcserver.regtest);
const keythereum = require("keythereum");
keythereum.constants.quiet = true;
let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
let SendFromWeb3 = require("./wanchainsender/index.js").SendFromWeb3;
let sendTransaction = require('./cross_send/sendTransaction.js');

let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
let databaseGroup = require('./wanchaindb/index.js').databaseGroup;
let keystoreDir = require('wanchain-keystore').keystoreDir;
let logger;
let config;
const WebSocket = require('ws');
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const FEE = 0.001

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
    toGwei(swei){
        let exp = new BigNumber(10);
        let wei = new BigNumber(swei);
        let gwei = wei.dividedBy(exp.pow(9));
        return  gwei;
    },
    getConfig(){
        return config;
    },
    async init(cfg,ethsender, wansender,btcsender, cb){
        config = cfg? cfg:require('./config.js');
        this.EthKeyStoreDir =  new keystoreDir(config.ethKeyStorePath),
        this.WanKeyStoreDir =  new keystoreDir(config.wanKeyStorePath),
        this.ethSender = ethsender;
        this.btcSender = btcsender;
        this.wanSender = wansender;
        if(config.useLocalNode && !this.web3Sender){
            this.web3Sender =  this.createrWeb3Sender(config.rpcIpcPath);
        }
        logger = config.getLogger("crossChainUtil");
        this.ethAddrs  = Object.keys(this.EthKeyStoreDir.getAccounts());
        this.wanAddrs  = Object.keys(this.WanKeyStoreDir.getAccounts());
        global.lockedTime = await this.getWanLockTime(this.wanSender);
        console.log("global.lockedTime: ",global.lockedTime);
        this.c2wRatio = await this.getBtcC2wRatio(this.wanSender);
        console.log("this.c2wRatio:", this.c2wRatio);
        if(cb)cb();
    },

    createTrans(sender){
        return new sendTransaction(sender);
    },

    getCollection(dbName,collectionName){
        return databaseGroup.getCollection(dbName,collectionName);
    },
    getCrossdbCollection() {
        return this.getCollection(config.crossDbname,config.crossCollection);
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
    getBtcSmgList(sender) {
        let b = pu.promisefy(sender.sendMessage, ['syncStoremanGroups'], sender);
        return b;
    },
    getTxReceipt(sender,txhash){
        let bs = pu.promisefy(sender.sendMessage, ['getTransactionReceipt',txhash], sender);
        return bs;
    },
    getTxInfo(sender,txhash){
        let bs = pu.promisefy(sender.sendMessage, ['getTxInfo',txhash], sender);
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
        this.collection = this.getCrossdbCollection();
        let Data = this.collection.find(option);
        let his = [];
        for(var i=0;i<Data.length;++i){
            let Item = Data[i];
            his.push(Item);
        }
        return his;
    },
    async sendEthHash(sender, tx) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(tx.from, config.originalChainHtlc,tx.amount.toString(),tx.storemanGroup,tx.cross,tx.gas,this.toGweiString(tx.gasPrice.toString()),'ETH2WETH',tx.nonce);
        let txhash =  await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendWanNotice(sender, tx) {
        let newTrans = this.createTrans(sender);
        //    createDepositNotice(storeman,userWanAddr,hashx,txhash, lockedTimestamp, gas, pasPrice, wanFrom)
        newTrans.createDepositNotice(tx.storeman,tx.userWanAddr,tx.hashx, tx.txHash,tx.lockedTimestamp,
            tx.gas,this.toGwei(tx.gasPrice.toString()));
        let txhash =  await pu.promisefy(newTrans.sendNoticeTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendDepositX(sender, from,gas,gasPrice,x, passwd, nonce) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(from, config.wanchainHtlcAddr,null,null,null,gas,this.toGweiString(gasPrice),'ETH2WETH', nonce);
        newTrans.trans.setKey(x);
        let txhash =  await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
        return txhash;
    },
    async sendEthCancel(sender, from,gas,gasPrice,x, passwd, nonce) {
        let newTrans = this.createTrans(sender);
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
    getWithdrawRevokeEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawOriginRevokeEvent).toString('hex'), null,  hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
        return p;
    },
    getWithdrawCrossLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawCrossLockEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositCrossLockEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositBtcCrossLockEvent).toString('hex'), null, null, hashX];
        console.log("# topics:", topics);
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
    getWithdrawBtcRedeemEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.withdrawBtcRedeemNoticeEvent).toString('hex'), null, null, hashX];
        let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
        return p;
    },
    getDepositRevokeEvent(sender, hashX) {
        let topics = ['0x'+wanUtil.sha3(config.depositOriginRevokeEvent).toString('hex'), null,  hashX];
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
    getWanLockTime(sender){
        let p = pu.promisefy(sender.sendMessage, ['getScVar', config.wanchainHtlcAddr, 'lockedTime',config.HTLCWBTCInstAbi], sender);
        return p;
    },
    getBtcC2wRatio(sender){
        let p = pu.promisefy(sender.sendMessage, ['getCoin2WanRatio','BTC'], sender);
        return p;
    },
    getBtcUtxo(sender, minconf, maxconf, addresses){
        let p = pu.promisefy(sender.sendMessage, ['getUTXO', minconf, maxconf, addresses], sender);
        return p;
    },
    generateP2shScript(p2shAddr){
        let b1 = Buffer.from('a9','hex');
        let b2 = Buffer.from(p2shAddr, 'hex');
        let b3 = Buffer.from('87','hex');
        let b = Buffer.concat([b1,b2,b3]);
        return b;
    },
    // storeman
    async _verifyBtcUtxo(storemanAddr, txHash, xHash, lockedTimestamp){ // utxo.amount
        try {
            let rewTx = await client.getRawTransaction(txHash);
            //ccUtil.getTxInfo();
            let ctx = bitcoin.Transaction.fromHex(Buffer.from(rewTx, 'hex'),bitcoin.networks.testnet);
            console.log("verifyBtcUtxo ctx:", ctx);
            let contract = btcUtil.hashtimelockcontract(storemanAddr, xHash, lockedTimestamp);
            let p2sh = contract['p2sh'];
            let outs = ctx.outs;
            let i;
            for(i=0; i<outs.length; i++) {
                let out = outs[i];
                let outScAsm = bitcoin.script.toASM(out.script);
                let outScHex = out.script.toString('hex');
                console.log("outScAsm", outScAsm);
                console.log("outScHex", outScHex);
                const payload = bs58check.decode(p2sh).toString('hex');
                let p2shSc = this.generateP2shScript(payload).toString('hex');
                if(outScHex == p2shSc){
                    break;
                }
            }
            if(i == outs.length){
                console.log("TODO: p2sh, hash160");
                console.log(outs[0]);
                return outs[0].value;
            }
            return outs[i].amount;
        }catch(err){
            console.log("verifyBtcUtxo: ",err);
            return 0;
        }
    },
    // async _spendP2SHUtxo(storemanAddr, txHash, xHash, x, lockedTimestamp){
    //     try {
    //         let contract = btcUtil.hashtimelockcontract(storemanAddr, xHash, lockedTimestamp);
    //         let p2sh = contract['p2sh'];
    //         let rawTx = await client.getRawTransaction(txHash);
    //         let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'),bitcoin.networks.testnet);
    //         console.log("verifyBtcUtxo ctx:", ctx);
    //         let outs = ctx.outs;
    //         let i;
    //         for(i=0; i<outs.length; i++) {
    //             let out = outs[i];
    //             let outScAsm = bitcoin.script.toASM(out.script);
    //             let outScHex = out.script.toString('hex');
    //             console.log("outScAsm", outScAsm);
    //             console.log("outScHex", outScHex);
    //             let p2shSc = generateP2shScript(p2sh).toString('hex');
    //             if(outScHex == p2shSc){
    //                 break;
    //             }
    //         }
    //         if(i == outs.length){
    //             throw "error p2sh";
    //         }
    //         let hashid = await redeem(contract, {txid:txHash, vout:i}, x);
    //         console.log("redeem hashid: ", hashid);
    //         return hashid;
    //     }catch(err){
    //         console.log("verifyBtcUtxo: ",err);
    //         throw err;
    //     }
    //
    // },
    getEthBalance(sender, addr) {
        let bs = pu.promisefy(sender.sendMessage, ['getBalance',addr], sender);
        return bs;
    },
    getBlockByNumber(sender, blockNumber) {
        let bs = pu.promisefy(sender.sendMessage, ['getBlockByNumber',blockNumber], sender);
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
    calculateLocWanFee(value,coin2WanRatio,txFeeRatio){
        let wei     = web3.toWei(web3.toBigNumber(value));
        const DEFAULT_PRECISE = 10000;
        let fee = wei.mul(coin2WanRatio).mul(txFeeRatio).div(DEFAULT_PRECISE).div(DEFAULT_PRECISE).trunc();

        return '0x'+fee.toString(16);
    },
    async sendWanHash(sender, tx) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction(tx.from, config.wanchainHtlcAddr, tx.amount.toString(),tx.storemanGroup,tx.cross,tx.gas,this.toGweiString(tx.gasPrice.toString()),'WETH2ETH',tx.nonce);
        newTrans.trans.setValue(tx.value);
        let txhash =  await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
        return txhash;
    },
    async sendWanX(sender, from,gas,gasPrice,x, passwd, nonce) {
        let newTrans = this.createTrans(sender);
        newTrans.createTransaction( from, config.originalChainHtlc,null,null,null,gas,this.toGweiString(gasPrice),'WETH2ETH',nonce);
        newTrans.trans.setKey(x);
        let txhash =  await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
        return txhash;
    },
    async sendWanCancel(sender, from,gas,gasPrice,x, passwd,nonce) {
        let newTrans = this.createTrans(sender);
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
                console.log("commmand: ",command);
                return command;
            }
        }
    },
    updateStatus(key, Status){
        let value = this.collection.findOne({HashX:key});
        if(value){
            value.status = Status;
            this.collection.update(value);
        }
    },
    async fund(senderKp, ReceiverHash160Addr, value ){
        // generate script and p2sh address
        let blocknum = await this.getBlockNumber(this.btcSender);
        const lockTime = 1000;
        let redeemLockTimeStamp = blocknum + lockTime;

        let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
        let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
        console.log("############### x:",x);
        console.log("############### hashx:",hashx);
        let senderH160Addr = bitcoin.crypto.hash160(senderKp.publicKey).toString('hex');
        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, ReceiverHash160Addr,senderH160Addr);
        contract.x = x;
        contract.hashx = hashx;

        let utxos = await this.getBtcUtxo(this.btcSender, 0, 10000000, [btcUtil.getAddressbyKeypair(senderKp)]);
        let utxo = btcUtil.selectUtxoTest(utxos, value-FEE);
        if(!utxo){
            console.log("############## no utxo");
            throw("no utox.");
        }
        console.log("utxo: ", utxo);
        const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        txb.setVersion(1);
        txb.addInput(utxo.txid, utxo.vout);
        txb.addOutput(contract['p2sh'], (value-FEE-FEE)*100000000); // fee is 1
        txb.sign(0, senderKp);

        const rawTx = txb.build().toHex();
        console.log("rawTx: ", rawTx);

        let btcHash = await this.sendRawTransaction(this.btcSender,rawTx);
        console.log("btc result hash:", btcHash);
        contract.txHash = btcHash;
        return contract;
    },
    // when wbtc->btc,  storeman --> wallet.
    //storeman is sender.  wallet is receiverKp.
    // when btc->wbtc,  wallet --> storeman;
    // wallet is sender, storeman is receiver;
    async redeem(x,hashx, redeemLockTimeStamp, senderKp,receiverKp, value, txid, record){
        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp,
            bitcoin.crypto.hash160(receiverKp.publicKey).toString('hex'),bitcoin.crypto.hash160(senderKp.publicKey).toString('hex'));
        let redeemScript = contract['redeemScript'];
        //return this._redeem(redeemScript, txid, x,senderKp, receiverKp, value)
        return this._redeem(redeemScript,txid , x, storeman, alice, value);
    },
    async _redeem(redeemScript, txid, x, senderKp, receiverKp, value){
        //const redeemScript = contract['redeemScript'];

        var txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        txb.setVersion(1);
        txb.addInput(txid, 0);
        txb.addOutput(btcUtil.getAddressbyKeypair(alice), (value-FEE-FEE-FEE)*100000000);

        const tx = txb.buildIncomplete();
        const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

        const redeemScriptSig = bitcoin.payments.p2sh({
            redeem: {
                input: bitcoin.script.compile([  // TODO: alias is who
                    bitcoin.script.signature.encode(alice.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
                    alice.publicKey,
                    Buffer.from(x, 'hex'),
                    bitcoin.opcodes.OP_TRUE
                ]),
                output: redeemScript,
            },
            network: bitcoin.networks.testnet
        }).input;
        tx.setInputScript(0, redeemScriptSig);
        console.log("?????????????????redeemScriptSig: ", redeemScriptSig.toString('hex'));
        console.log("?????????????????redeemScriptSig: ASM ", bitcoin.script.toASM(redeemScriptSig));
        let lockS = bitcoin.script.toASM(redeemScriptSig).split(' ');
        console.log(lockS[4]);
        let sc2 = bitcoin.script.compile(Buffer.from(lockS[4],'hex'));
        console.log("?????????????????lockS: ASM ", bitcoin.script.toASM(sc2));


        console.log("alice.publicKey:", alice.publicKey.toString('hex'));
        console.log("redeem tx: ", tx);
        console.log("redeem raw tx: \n" + tx.toHex());
        const btcHash = await this.sendRawTransaction(this.btcSender, tx.toHex(),
            function(err){console.log(err);}
        );
        console.log("redeem tx id:" + btcHash);
        return btcHash;
    },

}

exports.Backend = Backend;
