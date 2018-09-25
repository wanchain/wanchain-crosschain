"use strict";

const WebSocket = require('ws');
const cm = require('../../comm.js');
const wsOptions = {
    'handshakeTimeout': 30000,
    rejectUnauthorized: false
};
let logDebug;

module.exports = class socketServer{
    constructor(url,messageFactory, passiveHandler){
        let self = this;
        this.wsUrl = url;
        this.connection = new WebSocket(url, wsOptions);
        this.messageFactory = messageFactory;
        this.passiveHandler = passiveHandler;
        logDebug = cm.getLogger('socketServer');
        this.functionDict = {};
        this.heartCheck();
        this.createWebSocket();
        this.initEventHandle();
    }
    initEventHandle() {
        this.connection.onmessage = (message) => {
            this.heartCheck.start();
            let msg = JSON.parse(message.data);
            if(msg.header.isSubscribe && passiveHandler){
                return self.passiveHandler(msg);
            }
            this.getmessage(msg);
        };

        this.connection.onopen = () => {
            this.heartCheck.start();
        };

        this.connection.on('pong', () => {
            this.heartCheck.start();
        });

        this.connection.onclose = () => {
            this.reconnect();
        };

        this.connection.onerror = () => {
            this.reconnect();
        };
    }

    heartCheck() {
        let that = this;
        this.heartCheck = {
            timeout: 15000,
            timeoutObj: null,
            serverTimeoutObj: null,
            reset() {
                clearTimeout(this.timeoutObj);
                clearTimeout(this.serverTimeoutObj);
            },
            start() {
                let self = this;
                this.reset();
                this.timeoutObj = setTimeout(function () {
                    that.connection.ping('{"event": "ping"}');
                    self.serverTimeoutObj = setTimeout(function () {
                        that.connection.close();
                    }, self.timeout);
                }, this.timeout);
            }
        };
    }

    createWebSocket() {
        try {
            this.connection = new WebSocket(this.wsUrl, wsOptions);
            this.initEventHandle();
        } catch (e) {
            this.reconnect();
        }
    }
    reconnect() {
        if (this.lockReconnect) {
            return;
        }
        this.lockReconnect = true;
        this.reTt && clearTimeout(this.reTt);
        this.reTt = setTimeout(() => {
            this.createWebSocket();
            this.lockReconnect = false;
        }, 2000);
    }
    send(json){
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
        logDebug.debug(message.message);
        this.send(message.message);
    }
    createMessageFunc(...args){
        let args1 = args.slice(1);
        logDebug.debug('createMessageFunc : ',args);
        return this.messageFactory[args[0]](...args1);
    }
}