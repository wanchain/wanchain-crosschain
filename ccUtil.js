'use strict'

const coinSelect = require('coinselect')
const feeRate = 55 // satoshis per byte

var crypto = require('crypto')
var secp256k1 = require('secp256k1')
var createKeccakHash = require('keccak')
const pu = require('promisefy-util');
const BigNumber = require('bignumber.js');
const wanUtil = require("wanchain-util");
const Client = require('bitcoin-core');
const bitcoin = require('bitcoinjs-lib');
const btcUtil = require('./btcUtil').btcUtil;
const bs58check = require('bs58check');

var alice = bitcoin.ECPair.fromWIF(
	'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
);
const aliceHash160Addr = bitcoin.crypto.hash160(alice.publicKey).toString('hex');
const storemanWif = 'cQrhq6e1bWZ8YBqaPcg5Q8vwdhEwwq1RNsMmv2opPQ4fuW2u8HYn';
const storemanHash160Addr = "0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe";
var storeman = bitcoin.ECPair.fromWIF(
	storemanWif, bitcoin.networks.testnet
);

function getAddress(keypair) {
	const pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
	return pkh.address;
}

const aliceAddr = getAddress(alice);
const storemanAddr = getAddress(storeman);

let client;
const keythereum = require("keythereum");
keythereum.constants.quiet = true;
let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
let SendFromWeb3 = require("./wanchainsender/index.js").SendFromWeb3;
let sendTransaction = require('./cross_send/sendTransaction.js');
let btcWanTxSendRec = require('./cross_send/btcWanTxSendRec.js');

let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
let databaseGroup = require('./wanchaindb/index.js').databaseGroup;
let keystoreDir = require('wanchain-keystore').keystoreDir;
let logger;
let config;
const WebSocket = require('ws');
const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const FEE = 100000
const MAX_CONFIRM_BLKS = 10000000
const MIN_CONFIRM_BLKS = 0
const LOCK_BLK_NUMBER = 10

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4
const TX_INPUT_BASE = 32 + 4 + 1 + 4
const TX_INPUT_PUBKEYHASH = 107
const TX_OUTPUT_BASE = 8 + 1
const TX_OUTPUT_PUBKEYHASH = 25
const network = bitcoin.networks.testnet
var contractsMap = {}
var XXMap = {}

function keyPairArray2AddrArray(kps) {
	let addrs = [];
	for(let i=0; i<kps.length; i++){
		addrs.push(getAddress(kps[i]));
	}
	return addrs;
}

const Backend = {
	CreaterSockSenderByChain(ChainType) {
		return new sendFromSocket(new socketServer(config.socketUrl, messageFactory), ChainType);
	},
	async createrSocketSender(ChainType) {
		let sender = this.CreaterSockSenderByChain(ChainType);
		await pu.promiseEvent(this.CreaterSockSenderByChain, [ChainType], sender.socket.connection, "open");
		return sender;
	},

	toGweiString(swei) {
		let exp = new BigNumber(10);
		let wei = new BigNumber(swei);
		let gwei = wei.dividedBy(exp.pow(9));
		return gwei.toString(10);
	},
	toGwei(swei) {
		let exp = new BigNumber(10);
		let wei = new BigNumber(swei);
		let gwei = wei.dividedBy(exp.pow(9));
		return gwei;
	},
	getConfig() {
		return config;
	},
	async init(cfg, ethsender, wansender, btcsender, cb) {
		config = cfg ? cfg : require('./config.js');
		this.config = config;
		this.client = new Client(global.config.btcServer.regtest);
		client = this.client;
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
		global.lockedTime = await this.getWanLockTime(this.wanSender);
		console.log("global.lockedTime: ", global.lockedTime);
		this.c2wRatio = await this.getBtcC2wRatio(this.wanSender);
		console.log("this.c2wRatio:", this.c2wRatio);
		if (cb) cb();
	},

	createTrans(sender) {
		return new sendTransaction(sender);
	},

	getCollection(dbName, collectionName) {
		return databaseGroup.getCollection(dbName, collectionName);
	},
	getCrossdbCollection() {
		return this.getCollection(config.crossDbname, config.crossCollection);
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
		newTrans.createTransaction(tx.from, config.originalChainHtlc, tx.amount.toString(16), tx.storemanGroup, tx.cross,
			tx.gas, tx.gasPrice.toString(16), 'ETH2WETH', tx.nonce);
		let txhash = await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
		return txhash;
	},
	async sendWanNotice(sender, tx) {
		let newTrans = this.createTrans(sender);
		newTrans.createDepositNotice(tx.from, tx.storeman, tx.userH160, tx.hashx, tx.txHash, tx.lockedTimestamp,
			tx.gas, tx.gasPrice.toString(16));
		let txhash = await pu.promisefy(newTrans.sendNoticeTrans, [tx.passwd], newTrans);

    //to save to db
    tx.txhash = txhash
    this.btcWanNoticeSave(tx)

		return txhash;
	},
	async sendDepositX(sender, from, gas, gasPrice, x, passwd, nonce) {
		let newTrans = this.createTrans(sender);
		newTrans.createTransaction(from, config.wanchainHtlcAddr, null, null, null, gas, gasPrice, 'ETH2WETH', nonce);
		newTrans.trans.setKey(x);
		let txhash = await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
		return txhash;
	},
	async sendEthCancel(sender, from, gas, gasPrice, x, passwd, nonce) {
		let newTrans = this.createTrans(sender);
		newTrans.createTransaction(from, config.originalChainHtlc, null, null, null, gas, gasPrice, 'ETH2WETH', nonce);
		newTrans.trans.setKey(x);
		let txhash = await pu.promisefy(newTrans.sendRevokeTrans, [passwd], newTrans);
		return txhash;
	},
	getDepositOrigenLockEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.depositOriginLockEvent).toString('hex'), null, null, hashX];
		let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
		return b;
	},
	getWithdrawOrigenLockEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.withdrawOriginLockEvent).toString('hex'), null, null, hashX];
		let b = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
		return b;
	},
	getWithdrawRevokeEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.withdrawOriginRevokeEvent).toString('hex'), null, hashX];
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
		return p;
	},
	getWithdrawCrossLockEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.withdrawBtcCrossLockEvent).toString('hex'), null, null, hashX];
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
		return p;
	},
	getDepositCrossLockEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.depositBtcCrossLockEvent).toString('hex'), null, null, hashX];
		console.log("# topics:", topics);
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
		return p;
	},
	getDepositOriginRefundEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.depositOriginRefundEvent).toString('hex'), null, null, hashX];
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.wanchainHtlcAddr, topics], sender);
		return p;
	},
	getWithdrawOriginRefundEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.withdrawOriginRefundEvent).toString('hex'), null, null, hashX];
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
		return p;
	},
	getWithdrawBtcRedeemEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.withdrawBtcRedeemNoticeEvent).toString('hex'), null, null, hashX];
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
		return p;
	},
	getDepositRevokeEvent(sender, hashX) {
		let topics = ['0x' + wanUtil.sha3(config.depositOriginRevokeEvent).toString('hex'), null, hashX];
		let p = pu.promisefy(sender.sendMessage, ['getScEvent', config.originalChainHtlc, topics], sender);
		return p;
	},
	getDepositHTLCLeftLockedTime(sender, hashX) {
		let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.originalChainHtlc, 'getHTLCLeftLockedTime', [hashX], config.HTLCETHInstAbi], sender);
		return p;
	},
	getWithdrawHTLCLeftLockedTime(sender, hashX) {
		let p = pu.promisefy(sender.sendMessage, ['callScFunc', config.wanchainHtlcAddr, 'getHTLCLeftLockedTime', [hashX], config.HTLCWETHInstAbi], sender);
		return p;
	},
	monitorTxConfirm(sender, txhash, waitBlocks) {
		let p = pu.promisefy(sender.sendMessage, ['getTransactionConfirm', txhash, waitBlocks], sender);
		return p;
	},
	getEthLockTime(sender) {
		let p = pu.promisefy(sender.sendMessage, ['getScVar', config.originalChainHtlc, 'lockedTime', config.HTLCETHInstAbi], sender);
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
	async getP2SHXByHash(sender, hashx) {
		let p = pu.promisefy(sender.sendMessage, ['getP2SHXByHash',  hashx], sender);
		return p;
	},
	async clientGetBtcUtxo(minconf, maxconf, addresses){
		let utxos = await client.listUnspent(minconf, maxconf, addresses);
		utxos = utxos.map(function (item, index) {
			let av = item.value ? item.value : item.amount;
			item.value = av * 100000000;
			item.amount = av * 100000000;
			return item;
		});
		return utxos;
	},
	async getBtcUtxo(sender, minconf, maxconf, addresses) {
		let utxos = await this._getBtcUtxo(sender, minconf, maxconf, addresses);
		let len = utxos.length;
		utxos = utxos.map(function (item, index) {
			let av = item.value ? item.value : item.amount;
			item.value = av * 100000000;
			item.amount = av * 100000000;
			return item;
		});
		return utxos;
	},
	generateP2shScript(p2shAddr) {
		let b1 = Buffer.from('a9', 'hex');
		let b2 = Buffer.from(p2shAddr, 'hex');
		let b3 = Buffer.from('87', 'hex');
		let b = Buffer.concat([b1, b2, b3]);
		return b;
	},
	// storeman
	async _verifyBtcUtxo(storemanAddr, txHash, hashx, lockedTimestamp) { // utxo.amount
		try {
			let rewTx = await client.getRawTransaction(txHash);
			//ccUtil.getTxInfo();
			let ctx = bitcoin.Transaction.fromHex(Buffer.from(rewTx, 'hex'), bitcoin.networks.testnet);
			console.log("verifyBtcUtxo ctx:", ctx);
			if (ctx) {
				return ctx.outs[0].value;
			}
			return 0;
			//TODO: add user.
			// let contract = btcUtil.hashtimelockcontract(hashx, lockedTimestamp,storemanAddr, );
			// let p2sh = contract['p2sh'];
			// let outs = ctx.outs;
			// let i;
			// for(i=0; i<outs.length; i++) {
			//     let out = outs[i];
			//     let outScAsm = bitcoin.script.toASM(out.script);
			//     let outScHex = out.script.toString('hex');
			//     console.log("outScAsm", outScAsm);
			//     console.log("outScHex", outScHex);
			//     const payload = bs58check.decode(p2sh).toString('hex');
			//     let p2shSc = this.generateP2shScript(payload).toString('hex');
			//     if(outScHex == p2shSc){
			//         break;
			//     }
			// }
			// if(i == outs.length){
			//     console.log("TODO: p2sh, hash160");
			//     console.log(outs[0]);
			//     return outs[0].value;
			// }
			// return outs[i].amount;
		} catch (err) {
			console.log("verifyBtcUtxo: ", err);
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
	getWanBalance(sender, addr) {
		let bs = pu.promisefy(sender.sendMessage, ['getBalance', addr], sender);
		return bs;
	},
	getEthBalancesSlow(sender, adds) {
		let ps = [];

		// TODO: only support one request one time.
		for (let i = 0; i < adds.length; i++) {
			let b = pu.promisefy(sender.sendMessage, ['getBalance', adds[i]], sender);
			ps.push(b);
		}
		return ps;
	},
	calculateLocWanFee(value, coin2WanRatio, txFeeRatio) {
		let wei = web3.toBigNumber(value);
		const DEFAULT_PRECISE = 10000;
		let fee = wei.mul(coin2WanRatio).mul(txFeeRatio).div(DEFAULT_PRECISE).div(DEFAULT_PRECISE).trunc();

		return '0x' + fee.toString(16);
	},
	async sendWanHash(sender, tx) {
		let newTrans = this.createTrans(sender);
		newTrans.createTransaction(tx.from, config.wanchainHtlcAddr, tx.amount.toString(16), tx.storemanGroup, tx.cross,
			tx.gas, tx.gasPrice.toString(16), 'WETH2ETH', tx.nonce);
		if (tx.x) newTrans.trans.setKey(tx.x);
		newTrans.trans.setValue(tx.value);
		let txhash = await pu.promisefy(newTrans.sendLockTrans, [tx.passwd], newTrans);
		return txhash;
	},
	async sendWanX(sender, from, gas, gasPrice, x, passwd, nonce) {
		let newTrans = this.createTrans(sender);
		newTrans.createTransaction(from, config.originalChainHtlc, null, null, null, gas, gasPrice, 'WETH2ETH', nonce);
		newTrans.trans.setKey(x);
		let txhash = await pu.promisefy(newTrans.sendRefundTrans, [passwd], newTrans);
		return txhash;
	},
	async sendWanCancel(sender, from, gas, gasPrice, x, passwd, nonce) {
		let newTrans = this.createTrans(sender);
		newTrans.createTransaction(from, config.wanchainHtlcAddr, null, null, null, gas, gasPrice, 'WETH2ETH', nonce);
		newTrans.trans.setKey(x);
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
				console.log("commmand: ", command);
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
	async btc2wbtcLock(senderKp,  ReceiverHash160Addr, value, hashx) {
		// generate script and p2sh address
		//let blocknum = await this.getBlockNumber(this.btcSender);
		//let redeemLockTimeStamp = blocknum + global.config.lockTime;
        let cur = Math.floor(Date.now()/1000);
        let redeemLockTimeStamp = cur + Number(global.lockedTime);
		let x,wallet;
		if(!hashx){
			wallet = true;
			x = this.generatePrivateKey().slice(2); // hex string without 0x
			hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
		}
		console.log("############### x:", x);
		console.log("############### hashx:", hashx);
		let senderH160Addr = bitcoin.crypto.hash160(senderKp[0].publicKey).toString('hex');
		let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, ReceiverHash160Addr, senderH160Addr);
		contract.x = x;
		console.log("############### contract:", contract);
		let target = {
			address: contract['p2sh'],
			value: value
		};
		let sendResult;
		if(wallet){
            sendResult = await this.btcTxBuildSendWallet(senderKp, target, global.config.feeRate);
			console.log("############### btcTxBuildSendWallet sendResult:", sendResult);

		}else {
			//senrResult = await this.btcTxBuildSendWallet(senderKp, target, global.config.feeRate);
            sendResult = await this.btcTxBuildSendStoreman(senderKp, target, global.config.feeRate);
			console.log("############### btcTxBuildSendStoreman sendResult:", sendResult);
		}

        contract.hashx = hashx;
        contract.redeemLockTimeStamp = redeemLockTimeStamp;
        contract.ReceiverHash160Addr = ReceiverHash160Addr;
        contract.senderH160Addr = senderH160Addr
        contract.txhash = sendResult.result;
        contract.x = x;
        contract.value = value;
        contract.feeRate = feeRate;
        contract.fee = sendResult.fee;

        this.btcLockSave(contract)

		return contract;
	},
	async fund(senderKp, ReceiverHash160Addr, value) {
	    // for wallet senderKp is array.
		return this.btc2wbtcLock(senderKp, ReceiverHash160Addr, value,null);
	},
	async Storemanfund(senderKp, ReceiverHash160Addr, value, hashx) {
	    // change to array
		return this.btc2wbtcLock([senderKp], ReceiverHash160Addr, value, hashx);
	},
	//
	// async Storemanfund(senderKp, ReceiverHash160Addr, value, hashx) {
	// 	// generate script and p2sh address
	// 	let blocknum = await this.getBlockNumber(this.btcSender);
	// 	const lockTime = 1000;
	// 	let redeemLockTimeStamp = blocknum + lockTime;
	//
	// 	// let x = btcUtil.generatePrivateKey().slice(2); // hex string without 0x
	// 	// let hashx = bitcoin.crypto.sha256(Buffer.from(x, 'hex')).toString('hex');
	// 	// console.log("############### x:",x);
	// 	console.log("############### hashx:", hashx);
	// 	let senderH160Addr = bitcoin.crypto.hash160(senderKp.publicKey).toString('hex');
	// 	let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp, ReceiverHash160Addr, senderH160Addr);
	// 	contract.hashx = hashx;
	//
	// 	let utxos = await client.listUnspent(0, 10000000, [btcUtil.getAddressbyKeypair(senderKp)]);
	// 	utxos.map(function (item, index) {
	// 		let av = item.value ? item.value : item.amount;
	// 		item.value = av * 100000000;
	// 		item.amount = av * 100000000;
	// 	});
	//
	// 	let utxo = btcUtil.selectUtxoTest(utxos, value - FEE);
	// 	if (!utxo) {
	// 		console.log("############## no utxo");
	// 		throw("no utox.");
	// 	}
	// 	console.log("utxo: ", utxo);
	// 	const txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
	// 	txb.setVersion(1);
	// 	txb.addInput(utxo.txid, utxo.vout);
	// 	txb.addOutput(contract['p2sh'], (value - FEE)); // fee is 1
	// 	txb.sign(0, senderKp);
	//
	// 	const rawTx = txb.build().toHex();
	// 	console.log("rawTx: ", rawTx);
	//
	// 	let btcHash = await client.sendRawTransaction(rawTx, true);
	// 	console.log("btc result hash:", btcHash);
	// 	contract.txHash = btcHash;
	// 	return contract;
	// },
	// wallet api, use api server.
	async getUtxoValueByIdWallet(txid) {
		let rawTx = await this.getRawTransaction(this.btcSender, txid);
		let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'), bitcoin.networks.testnet);
		return ctx.outs[0].value;
	},
	// wallet api, use client.
	async getUtxoValueByIdStoreman(txid) {
		let rawTx = await client.getRawTransaction(txid);
		let ctx = bitcoin.Transaction.fromHex(Buffer.from(rawTx, 'hex'), bitcoin.networks.testnet);
		return ctx.outs[0].value;
	},

    // when btc -- > wbtc, alice is revoker,  storeman is receiver.
    // when wbtc --> btc,  alice is receiver,  storeman is revoker.
    async revoke(hashx, redeemLockTimeStamp, receiverH160Addr, revokeKp, amount, txid, vout=0) {
	      let senderH160Addr = bitcoin.crypto.hash160(revokeKp.publicKey).toString('hex');
        let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp,receiverH160Addr,senderH160Addr);
        let redeemScript = contract['redeemScript'];
        console.log("redeem redeemScript:", redeemScript);

        let res = await this._revoke(hashx, txid, vout, amount, redeemScript, redeemLockTimeStamp, revokeKp);

        contract.txhash = res;
        contract.hashx = hashx;
        contract.redeemLockTimeStamp = redeemLockTimeStamp;
        contract.ReceiverHash160Addr = receiverH160Addr;
        contract.senderH160Addr = senderH160Addr
        contract.value = value;
        contract.feeRate = feeRate;
        contract.fee = FEE;

        this.btcRevokeSave(contract);

        return res;

    },
    // call this function to revoke locked btc
    async _revoke(hashx, txid,vout,amount, redeemScript, redeemLockTimeStamp, revokerKeyPair) {
        let txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
        txb.setLockTime(redeemLockTimeStamp);
        txb.setVersion(1);
        txb.addInput(txid, vout, 0);
        txb.addOutput(this.getAddress(revokerKeyPair), (amount - FEE));

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
        let result = await this.sendRawTransaction(this.btcSender, rawTx);
        console.log('result hash:', result);
        return result
    },
	// when wbtc->btc,  storeman --> wallet.
	//storeman is sender.  wallet is receiverKp.
	// when btc->wbtc,  wallet --> storeman;
	// wallet is sender, storeman is receiver;
	async redeem(x, hashx, redeemLockTimeStamp, senderH160Addr, receiverKp, value, txid) {

    let receiverHash160Addr = bitcoin.crypto.hash160(receiverKp.publicKey).toString('hex');
		let contract = await btcUtil.hashtimelockcontract(hashx, redeemLockTimeStamp,receiverHash160Addr, senderH160Addr);
		let redeemScript = contract['redeemScript'];
		console.log("redeem redeemScript:", redeemScript);

		let res = await this._redeem(redeemScript, txid, x, receiverKp, value);

    contract.txhash = res;
    contract.hashx = hashx;
    contract.redeemLockTimeStamp = redeemLockTimeStamp;
    contract.ReceiverHash160Addr = receiverHash160Addr;
    contract.senderH160Addr = senderH160Addr
    contract.x = x;
    contract.value = value;
    contract.feeRate = feeRate;
    contract.fee = FEE;

    this.btcRedeemSave(contract);

		return res;
	},
	async _redeem(redeemScript, txid, x, receiverKp, value) {
		//const redeemScript = contract['redeemScript'];

		var txb = new bitcoin.TransactionBuilder(bitcoin.networks.testnet);
		txb.setVersion(1);
		txb.addInput(txid, 0);
		txb.addOutput(btcUtil.getAddressbyKeypair(receiverKp), (value - FEE));

		const tx = txb.buildIncomplete();
		const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

		const redeemScriptSig = bitcoin.payments.p2sh({
			redeem: {
				input: bitcoin.script.compile([  // TODO: alias is who
					bitcoin.script.signature.encode(receiverKp.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
					receiverKp.publicKey,
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
		let sc2 = bitcoin.script.compile(Buffer.from(lockS[4], 'hex'));
		console.log("?????????????????lockS: ASM ", bitcoin.script.toASM(sc2));


		console.log("alice.publicKey:", alice.publicKey.toString('hex'));
		console.log("redeem tx: ", tx);
		console.log("redeem raw tx: \n" + tx.toHex());
		let btcHash;
		try {
            btcHash = await this.sendRawTransaction(this.btcSender, tx.toHex());
        }catch(err){
		    console.log("###########err: ", err);
        }

		console.log("redeem tx id:" + btcHash);
		return btcHash;
	},

	/// /////////////////////////////////////////////////btc functions///////////////////////////////////////////////////////

	hashtimelockcontract(storemanHash160, redeemblocknum, destHash160, revokerHash160) {
		let x = redeemblocknum.toString(16)
		let hashx = bitcoin.crypto.sha256(x).toString('hex')
		let redeemScript = bitcoin.script.compile([
			/* MAIN IF BRANCH */
			bitcoin.opcodes.OP_IF,
			bitcoin.opcodes.OP_SHA256,
			Buffer.from(hashx, 'hex'),
			bitcoin.opcodes.OP_EQUALVERIFY,
			bitcoin.opcodes.OP_DUP,
			bitcoin.opcodes.OP_HASH160,

			Buffer.from(destHash160, 'hex'), // wallet don't know storeman pubkey. //bitcoin.crypto.hash160(storeman.publicKey),//storeman.getPublicKeyBuffer(),// redeemer address
			// bitcoin.crypto.hash160(storeman.publicKey),
			bitcoin.opcodes.OP_ELSE,
			bitcoin.script.number.encode(redeemblocknum),
			bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
			bitcoin.opcodes.OP_DROP,
			bitcoin.opcodes.OP_DUP,
			bitcoin.opcodes.OP_HASH160,

			Buffer.from(revokerHash160, 'hex'),
			// bitcoin.crypto.hash160(alice.publicKey),//alice.getPublicKeyBuffer(), // funder addr
			/* ALMOST THE END. */
			bitcoin.opcodes.OP_ENDIF,

			// Complete the signature check.
			bitcoin.opcodes.OP_EQUALVERIFY,
			bitcoin.opcodes.OP_CHECKSIG
		])
		console.log(redeemScript.toString('hex'))
		// var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
		// var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

		let addressPay = bitcoin.payments.p2sh({
			redeem: {output: redeemScript, network: bitcoin.networks.testnet},
			network: bitcoin.networks.testnet
		})
		let address = addressPay.address

		return {
			'p2sh': address,
			'x': x,
			'hashx': hashx,
			'redeemblocknum': redeemblocknum,
			'redeemScript': redeemScript
		}
	},

	getUTXOSBalance(utxos) {
		let sum = 0
		let i = 0
		for (i = 0; i < utxos.length; i++) {
			sum += utxos[i].value
		}
		console.log('utxo balance=' + sum)

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
			if (utxo.confirmations >= MIN_CONFIRM_BLKS) {
				availableSat += Math.round(utxo.value)
				ninputs++
				inputs.push(utxo)
				fee = this.getTxSize(ninputs, 2) * feeRate
				if (availableSat >= target.value + fee) {
					break
				}
			}
		}

		if (availableSat < target.value) {
			return new Error('You do not have enough in your wallet')
		}

		fee = this.getTxSize(ninputs, 2) * feeRate
		let change = availableSat - target.value - fee

		if (fee > target.value) {
			return new Error('target value must be larger than the fee')
		}

		outputs.push(target)
		outputs.push({'value': change})

		return {inputs, outputs, fee}
	},





	async wbtc2btcLock(keyPairArray, amount, feeRate, destPub) {
		let XX = this.generatePrivateKey()
		let hashX = this.getHashKey(XX)

		// generate script and p2sh address
		let contract = await this.hashtimelockcontract(hashX, LOCK_BLK_NUMBER, destPub, bitcoin.crypto.hash160(keyPairArray[0].publicKey));

		let txId = await this.lock(contract, amount, keyPairArray, feeRate)

		if (txId != undefined) {
			// record it in map
			contractsMap[txId] = contract
			XXMap[txId] = XX
			return {txId: txId, hashX: hashX, redeemblocknum: contract['redeemblocknum']}
		} else {
			return null
		}
	},

	async btc2wbtcRefund(txHash, refunderKeyPair) {
		let rawTx = getTxInfo(txHash)
		let XX = XXMap[txHash]

		return this.refund(rawTx, XX, refunderKeyPair)
	},

	async wbtc2btcrefund(txHash, refunderKeyPair) {
		let XX = XXMap[txHash]
		let rawTx = getTxInfo(txHash)
		return this.refund(rawTx, XX, refunderKeyPair)
	},

	async btc2wbtcRevoke(txHash, revokerKeyPair) {
		let hashX = this.getHashKey(XXMap[txHash])
		let rawTx = getTxInfo(txHash)

		return await this.revoke(rawTx, revokerKeyPair)
	},

	async wbtc2btcRevoke(txHash, revokerKeyPair) {
		let rawTx = getTxInfo(txHash)
		return await this.revoke(rawTx, revokerKeyPair)
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
		console.log("addressArray:", addressArray);
		let balance = this.getUTXOSBalance(utxos)
		if (balance <= target.value) {
			console.log(" balance <= target.value");
			return null;
		}

		let {inputs, outputs, fee} = this.coinselect(utxos, target, feeRate)

		// .inputs and .outputs will be undefined if no solution was found
		if (!inputs || !outputs) {
			return {'result': null, 'error': new Error('utxo balance is not enough')}
		}

		console.log('fee', fee)

		let txb = new bitcoin.TransactionBuilder(network)

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

		for (i = 0; i < inputs.length; i++) {
			let inItem = inputs[i]
			let from = inItem.address
			let signer = addressKeyMap[from]
			txb.sign(i, signer)
		}

		const rawTx = txb.build().toHex()
		console.log('rawTx: ', rawTx)

		return {rawTx: rawTx, fee: fee};
	},
	async btcTxBuildSendWallet(keyPairArray, target,  feeRate) {
		let utxos;
		try {
			let addArr = keyPairArray2AddrArray(keyPairArray);
			console.log("############ addArr:", addArr);
			utxos = await this.getBtcUtxo(this.btcSender,MIN_CONFIRM_BLKS, MAX_CONFIRM_BLKS, addArr);
		} catch (err) {
			console.log("#################err:", err);
			throw err;
		}
		const {rawTx, fee} = await this.btcBuildTransaction(utxos, keyPairArray, target, feeRate);
		if (!rawTx) {
			throw("no enough utxo.");
		}
		console.log("###############rawTx: ", rawTx);
		let result = await this.sendRawTransaction(this.btcSender, rawTx);
		console.log('result hash:', result);
		return {result: result, fee: fee}
	},
	async btcTxBuildSendStoreman(keyPairArray, target,  feeRate) {
		let utxos;
		try {
			let addArr = keyPairArray2AddrArray(keyPairArray);
			console.log("############ addArr:", addArr);
			utxos = await this.clientGetBtcUtxo(MIN_CONFIRM_BLKS, MAX_CONFIRM_BLKS, addArr);
		} catch (err) {
			console.log("#################err:", err);
			throw err;
		}
		console.log("#################utxos:", utxos);

		const {rawTx, fee} = await this.btcBuildTransaction(utxos, keyPairArray, target, feeRate);
		if (!rawTx) {
			throw("no enough utxo.");
		}
		console.log("#############rawTx: ", rawTx);
		let result = await client.sendRawTransaction(rawTx);
		console.log('#############result hash:', result);
		return {result: result, fee: fee}
	},
	// async lock(contract, amount, keyPairArray, feeRate) {
	// 	// define target utxo
	// 	let targets = [
	// 		{
	// 			address: contract['p2sh'],
	// 			value: amount * 100000000
	// 		}
	// 	]
	//
	// 	return await this.btcTxBuildSend(keyPairArray, amount, targets, feeRate).result
	// },

	// call this function to refund locked btc
	async refund(fundtx, XX, refunderKeyPair) {
		// get the contract from buffer
		let contract = contractsMap[fundtx.vout.address]
		if (contract == undefined) {
			return null
		}

		let redeemScript = contract['redeemScript']

		let txb = new bitcoin.TransactionBuilder(network)
		txb.setVersion(1)

		print4debug('----W----A----N----C----H----A----I----N----')
		print4debug(JSON.stringify(fundtx))
		print4debug('----W----A----N----C----H----A----I----N----')

		txb.addInput(fundtx.txid, fundtx.vout)
		txb.addOutput(this.getAddress(refunderKeyPair), (fundtx.amount - FEE) * 100000000)

		let tx = txb.buildIncomplete()
		let sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL)

		let redeemScriptSig = bitcoin.payments.p2sh({
			redeem: {
				input: bitcoin.script.compile([
					bitcoin.script.signature.encode(refunderKeyPair.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
					refunderKeyPair.pubkey,
					Buffer.from(XX, 'utf-8'),
					bitcoin.opcodes.OP_TRUE
				]),
				output: redeemScript
			},
			network: network
		}).input

		tx.setInputScript(0, redeemScriptSig)

		let rawTx = tx.toHex()
		print4debug('redeem raw tx: \n' + rawTx)
		let result = await this.sendRawTransaction(this.btcSender, rawTx)
		console.log('result hash:', result)

		delete contractsMap[fundtx.vout.address]

		return {'result': result, 'error': null}
	},



  async btcSendTransaction (keyPairArray, amount, destAddress, feeRate) {
    let target = {
      address: destAddress,
      value: Math.round(amount * 100000000)
    }

    return await this.btcTxBuildSend(keyPairArray, amount, target, feeRate)
  },
  
   redeemSriptCheck(sriptData){
		
		try {
			
            const XPOS = 2;

            const FIXED_HASHX = '0x7eadc448515742a095d9e8cae09755e3e55ef3e3a08e4e84ce7d7ec5801cf510';
            const LOCK_SC_POS = 4;

            const FIXED_HASH_X_POS = 2;
            const FIXED_LK_TIME = 100;
            const FIXED_LK_TIME_POS = 8;
            const FIXED_DEST_HASH160 = '0x9a6b60f74a6bae176df05c3b0a118f85bab5c585';
            const FIXED_DEST_HASH160_POS = 6;
            const FIXED_REVOKER_HASH160 = '0x3533435f431a6a016ed0de73bd9645c8e2694416';
            const FIXED_REVOKER_HASH160_POS = 13;

            let contract = btcUtil.hashtimelockcontract(FIXED_HASHX, FIXED_LK_TIME, FIXED_DEST_HASH160, FIXED_REVOKER_HASH160);
            let fixedRedeemScript = contract['redeemScript'];
            console.log("fixed redeem script")
            console.log(fixedRedeemScript.toString('hex'));

            //get the fixed script hash
            let fixedRedeemScriptHash = this.getHashKey('0x'+fixedRedeemScript);
            console.log('fixedRedeemScriptHash=' + fixedRedeemScriptHash.toString('hex'))

            let scInputs = bitcoin.script.compile(Buffer.from(sriptData, 'hex'));

            let lockSc = bitcoin.script.toASM(scInputs).split(' ');
            console.log(lockSc);
            let XX = lockSc[XPOS];

            let scOutput = bitcoin.script.compile(Buffer.from(lockSc[LOCK_SC_POS], 'hex'));

            let gotRedeemScriptArray = bitcoin.script.toASM(scOutput).split(' ');
            console.log(gotRedeemScriptArray);

            let gotHASHX = gotRedeemScriptArray[FIXED_HASH_X_POS];
            let gotLKTIME = gotRedeemScriptArray[FIXED_LK_TIME_POS];
            let gotDESTHASH160 = gotRedeemScriptArray[FIXED_DEST_HASH160_POS];
            let gotREVOKERHASH160 = gotRedeemScriptArray[FIXED_REVOKER_HASH160_POS];

            gotRedeemScriptArray[FIXED_HASH_X_POS] = FIXED_HASHX;
            gotRedeemScriptArray[FIXED_LK_TIME_POS] = FIXED_LK_TIME;
            gotRedeemScriptArray[FIXED_DEST_HASH160_POS] = FIXED_DEST_HASH160;
            gotRedeemScriptArray[FIXED_REVOKER_HASH160_POS] = FIXED_REVOKER_HASH160;

            let changedRedeemScript = '0x' + gotRedeemScriptArray.join(' ');
            let changedRedeemScriptHash = this.getHashKey(changedRedeemScript);


            if (fixedRedeemScriptHash == changedRedeemScriptHash) {
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
        let pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet})
        return pkh.address
    },


    hexTrip0x(hexs){
        if(0 == hexs.indexOf('0x')){
            return hexs.slice(2);
        }
        return hexs;
    },

    getHashKey(key1){
        //return BigNumber.random().toString(16);
        let key = hexTrip0x(key1);
        let hashKey = '0x'+bitcoin.crypto.sha256(Buffer.from(key, 'hex')).toString('hex');
        return hashKey;

    },

    generatePrivateKey(){
        let randomBuf;
        do{
            randomBuf = crypto.randomBytes(32);
        }while (!secp256k1.privateKeyVerify(randomBuf));
        return '0x' + randomBuf.toString('hex');
    },

    getBtcWanCrossdbCollection() {
	    let clctNm = config.crossCollection;
        if(clctNm == undefined){
	        clctNm = "crossTransaction"
        }
        return this.getCollection(config.crossDbname, clctNm);
    },

    getBtcWanTxHistory(option) {
        this.collection = this.getBtcWanCrossdbCollection();
        let Data = this.collection.find(option);
        let his = [];
        for (var i = 0; i < Data.length; ++i) {
            let Item = Data[i];
            his.push(Item);
        }
        return his;
    },

  formatInput (tx) {

    try {
      let ctx = {}
      ctx.from = this.hexTrip0x(tx.senderH160Addr)
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
        return {'error': new Error('hashx can not be undefined')}
      } else {
        ctx.hashx = this.hexTrip0x(tx.hashx)
      }

      ctx.feeRate = feeRate
      ctx.fee = tx.fee
      ctx.crossType = 'BTC2WAN'
      ctx.redeemLockTimeStamp = tx.redeemLockTimeStamp

      console.log('ctx=')
      console.log(ctx)
      return ctx

    } catch (e) {
      return {'error': new Error(e)}
    }
  },

  async btcLockSave (tx) {
    let newTrans = new btcWanTxSendRec()
    let ctx = this.formatInput(tx)

    if (ctx.error) {
      return
    }

    if (tx.txhash != undefined) {
      ctx.lockTxHash = this.hexTrip0x(tx.txhash)
    } else {
      return
    }

    let res = newTrans.insertLockData(ctx)

    if (res != undefined) {
      console.log(res.toString())
    }

    return res
  },

  async btcRedeemSave (tx) {
    let newTrans = new btcWanTxSendRec()
    let ctx = this.formatInput(tx)

    if (ctx.error) {
      return
    }

    if (tx.txhash != undefined) {
      ctx.refundTxHash = this.hexTrip0x(tx.txhash)
    } else {
      return
    }

    let res = newTrans.insertRefundData(ctx)

    if (res != undefined) {
      console.log(res.toString())
    }

    return res
  },

  async btcRevokeSave (tx) {
    let newTrans = new btcWanTxSendRec()
    let ctx = this.formatInput(tx)

    if (ctx.error) {
      return
    }

    if (tx.txhash != undefined) {
      ctx.revokeTxHash = this.hexTrip0x(tx.txhash)
    } else {
      return
    }

    let res = newTrans.insertRevokeData(ctx)
    if (res != undefined) {
      console.log(res.toString())
    }

    return res
  },

  async btcWanNoticeSave (tx) {
    let newTrans = new btcWanTxSendRec()

    if (!tx.txhash) {
      return
    }

    let ctx = {}
    ctx.hashx = this.hexTrip0x(tx.hashx);
    ctx.crossAddress = this.hexTrip0x(tx.from)
    ctx.txhash = this.hexTrip0x(tx.txhash)
    ctx.crossType = "BTC2WAN";
    let res = newTrans.insertWanNoticeData(ctx)
    if (res != undefined) {
      console.log(res.toString())
    }

    return res
  }

}

exports.Backend = Backend;
