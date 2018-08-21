"use strict";

const WebSocket = require('ws');
const wsOptions = {
  'handshakeTimeout': 12000,
  rejectUnauthorized: false        // add by Jacob for cerficate error!
};
let logDebug;

module.exports = class socketServer{
    constructor(url,messageFactory){
        let self = this;
        this.connection = new WebSocket(url, wsOptions);
        this.messageFactory = messageFactory;
        logDebug = global.getLogger('socketServer');
        this.connection.onerror = function (error) {
            logDebug.error('[+webSocket onError+]', error.toString());
            console.log("Error:",error);
        };
        this.connection.onmessage = function (message) {
            let value = JSON.parse(message.data);
            self.getmessage(value);
        }
        this.functionDict = {}
    }
    send(json){
        console.log("send ....");
        console.log("json = ",json);
        this.connection.send(JSON.stringify(json));
    }
    close(){
        this.connection.close();
    }
    getmessage(message){
        this.functionDict[message.header.index].onMessage(message);
        delete this.functionDict[message.header.index];
    }
    sendMessage(...args){
        return this.sendMessageFunc(this.createMessageFunc(...args));
    }
    sendMessageFunc(message){
        this.functionDict[message.message.header.index] = message;
        console.log("sendMessageFunc....");
        logDebug.debug(message.message);
        this.send(message.message);
    }
    createMessageFunc(...args){
        let args1 = args.slice(1);
        logDebug.debug('createMessageFunc : ',args);
        return this.messageFactory[args[0]](...args1);
    }
}
