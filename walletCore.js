"use strict";

let sendTransaction = require('./cross_send/sendTransaction.js');
let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
const sendFromWeb3 = require("./wanchainsender/index.js").SendFromWeb3;
const wanchaintrans = require("./wanchaintrans/index.js");
let keystoreDir = require('wanchain-keystore').keystoreDir;
let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
const mr =  require('./monitor.js').MonitorRecord;
const be =  require('./ccUtil.js').Backend;
const btcUtil =  require('./btcUtil.js').btcUtil;
const LokiDb = require('./wanchaindb/lib/lokiDbCollection');
const _ = require('underscore');
let config = require('./config');
const cm = require('./comm.js');
let montimer;
async function recordMonitor(config, ethSend,wanSend,btcSend){
    if(config.isStoreman) return;
    await mr.init(config, ethSend,wanSend,btcSend);
    if(montimer){
        clearInterval(montimer);
    }
    montimer = setInterval(function(){
        mr.monitorTask();
    }, 6000);
}
    /**
     * @class
     * @classdesc  Manage all the modules of SDK.
     */
class walletcore  {
  /**
   * @constructor
   * @param {Object}  cfg    - The Json format config.
   */
    constructor(cfg){
        _.extend(config, cfg);
        cm.setConfig(config);
        this.socketUrl = config.socketUrl;
        cm.getLogger = config.getLogger;
        this.wanSend = new sendFromSocket(null,'WAN');
        this.ethSend = new sendFromSocket(null,'ETH');
        this.btcSend = new sendFromSocket(null,'BTC');
        if(config.isStoreman){
            this.smgSend = new sendFromSocket(null,'SMG');
        }
        this.EthKeyStoreDir = new keystoreDir(config.ethKeyStorePath);
        this.WanKeyStoreDir = new keystoreDir(config.wanKeyStorePath);

        this.be = be;
        this.btcUtil = btcUtil;
        this.sendFromSocket = sendFromSocket;
        this.wanchaintrans = wanchaintrans;
    }
    close(){
        clearInterval(montimer);
        cm.crossDb.close();
        cm.walletDb.close();
        this.wanSend.socket.connection.close();
    }
    async reinit(){
        let config = cm.config;
        this.wanSend.socket.connection.close();
        let newWebSocket = new socketServer(config.socketUrl,messageFactory);
        this.wanSend.socket = newWebSocket;
        this.ethSend.socket = newWebSocket;
        this.btcSend.socket = newWebSocket;
        let self = this;
        return new Promise(function(resolve, fail){
            newWebSocket.connection.on('error', function _cb(err){
                fail(err);
            });
            newWebSocket.connection.on('open', function _cb(){
                recordMonitor(config,self.ethSend, self.wanSend, self.btcSend);
                be.init(config, self.ethSend, self.wanSend,self.btcSend,function(){
                    resolve();
                });
            })
        });
    }
    async storemanInit(){
        let config = cm.config;
        let crossDb = new LokiDb(cm.config.crossDbname);
        await crossDb.loadDatabase();
        cm.crossDb = crossDb;
        be.storemanInit(config);
    }
  /**
   * initiate the class
   */
    async init(){
        let config = cm.config;
        cm.EthKeyStoreDir = this.EthKeyStoreDir;
        cm.WanKeyStoreDir = this.WanKeyStoreDir;

        let crossDb = new LokiDb(cm.config.crossDbname);
        await crossDb.loadDatabase();
        cm.crossDb = crossDb;
        let walletDb = new LokiDb(cm.config.btcWallet);
        await walletDb.loadDatabase();
        cm.walletDb = walletDb;

        let newWebSocket = new socketServer(config.socketUrl,messageFactory);
        this.wanSend.socket = newWebSocket;
        this.ethSend.socket = newWebSocket;
        this.btcSend.socket = newWebSocket;
        let self = this;
        return new Promise(function(resolve, fail){
            newWebSocket.connection.on('error', function _cb(err){
                fail(err);
            });
            newWebSocket.connection.on('open', function _cb(){
                recordMonitor(config,self.ethSend, self.wanSend, self.btcSend);
                be.init(config, self.ethSend, self.wanSend,self.btcSend,function(){
                    resolve();
                });
            })
        });
    }
    createSendTransaction(ChainType){
        let sendGroup = ChainType == 'BTC' ? this.btcSend : this.wanSend;
        return new sendTransaction(sendGroup);
    }

    CreaterSender(ChainType) {
        if(this.socketUrl){
            return new sendFromSocket(new socketServer(this.socketUrl,messageFactory),ChainType);
        }
    }
    CreaterWeb3Sender(url) {
        return new sendFromWeb3(url);
    }

}
module.exports  = walletcore;
