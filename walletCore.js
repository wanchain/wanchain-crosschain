"use strict";

let databaseGroup = require('./wanchaindb/index.js').databaseGroup;
let sendTransaction = require('./cross_send/sendTransaction.js');
let crosschain = require('./dbDefine/crossTransDefine.js');
let sendFromSocket = require("./wanchainsender/index.js").SendFromSocket;
const sendFromWeb3 = require("./wanchainsender/index.js").SendFromWeb3;
const wanchaintrans = require("./wanchaintrans/index.js");
const NormalSend = wanchaintrans.NormalSend;
let keystoreDir = require('wanchain-keystore').keystoreDir;
let messageFactory = require('./webSocket/messageFactory.js');
let socketServer = require("./wanchainsender/index.js").socketServer;
const mr =  require('./monitor.js').MonitorRecord;
const be =  require('./ccUtil.js').Backend;
let montimer;
async function recordMonitor(config, ethSend,wanSend){
    await mr.init(config, ethSend,wanSend);
    if(montimer){
        clearInterval(montimer);
    }
    // montimer = setInterval(function(){
    //     mr.monitorTask();
    // }, 6000);

  montimer = setInterval(function(){
    mr.monitorTask();
  }, 600000); // change by Jacob only for ERC20 POC test.
}
class walletcore  {
    constructor(config){
        this.socketUrl = config.socketUrl;
        global.getLogger = config.getLogger;
        this.wanSend = new sendFromSocket(null,'WAN');
        this.ethSend = new sendFromSocket(null,'ETH');
        this.EthKeyStoreDir = new keystoreDir(config.ethKeyStorePath);
        this.WanKeyStoreDir = new keystoreDir(config.wanKeyStorePath);
        this.databaseGroup = databaseGroup;
        databaseGroup.useDatabase(config.databasePath,[crosschain]);
        this.be = be;
        this.sendFromSocket = sendFromSocket;
        this.wanchaintrans = wanchaintrans;
    }
    close(){
        clearInterval(montimer);
        for (var key in databaseGroup.databaseAry) {
            databaseGroup.databaseAry[key].db.close();
        }
        this.wanSend.socket.connection.close();
    }
    async reinit(config){
        this.wanSend.socket.connection.close();
        let newWebSocket = new socketServer(config.socketUrl,messageFactory);
        this.wanSend.socket = newWebSocket;
        this.ethSend.socket = newWebSocket;
        let self = this;
        return new Promise(function(resolve, fail){
            newWebSocket.connection.on('error', function _cb(err){
                fail(err);
            });
            newWebSocket.connection.on('open', function _cb(){
                recordMonitor(config,self.ethSend, self.wanSend);
                be.init(config, self.ethSend, self.wanSend,function(){
                    resolve();
                });
            })
        });
    }    
    async init(config){
        global.getCollection = this.getCollection;
        global.getCollectionCb = this.getCollectionCb;
        global.EthKeyStoreDir = this.EthKeyStoreDir;
        global.WanKeyStoreDir = this.WanKeyStoreDir;

        for (var key in databaseGroup.databaseAry) {
            await databaseGroup.databaseAry[key].init();
        }
        databaseGroup.inited = true;
        let newWebSocket = new socketServer(config.socketUrl,messageFactory);
        this.wanSend.socket = newWebSocket;
        this.ethSend.socket = newWebSocket;
        let self = this;
        return new Promise(function(resolve, fail){
            newWebSocket.connection.on('error', function _cb(err){
                fail(err);
            });
            newWebSocket.connection.on('open', function _cb(){
                recordMonitor(config,self.ethSend, self.wanSend);
                be.init(config, self.ethSend, self.wanSend,function(){
                    resolve();
                });
            })
        });
    }
    // protocol = E20, support E20 standard.
    // opt = LOCK, APPROVE,...
    createSendTransaction(ChainType, protocol="",opt=""){
        console.log(__filename);
        console.log("protocol:",protocol,"opt:",opt);
        let sendGroup = ChainType == 'ETH' ? this.ethSend : this.wanSend;
        return new sendTransaction(sendGroup,protocol,opt);
    }
    getCollection(dbName,collectionName){
        return databaseGroup.getCollection(dbName,collectionName);
    }
    loadDatabase(dbName, cb){
        return databaseGroup.databaseAry[dbName].db.loadDatabase({},cb);
    }

    async getCollectionCb(dbName,collectionName, cb){
        if(!databaseGroup.inited){
            for (var key in databaseGroup.databaseAry) {
                await databaseGroup.databaseAry[key].init();
            }
        }
        let collection = databaseGroup.getCollection(dbName,collectionName);
        cb(collection);
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
module.exports = global.walletcore = walletcore;
