"use strict";

let sendFromSocket = require("../wanchainsender/index.js").SendFromSocket;
let socketServer = require("../wanchainsender/index.js").socketServer;
let messageFactory = require('../webSocket/messageFactory.js');
exports.CreaterSender = function (ChainType,url) {
    let config = require('../ccUtil.js').getConfig();
    let socketUrl = url ? url : config.socketUrl;
    return new sendFromSocket(new socketServer(socketUrl,messageFactory),ChainType);
}