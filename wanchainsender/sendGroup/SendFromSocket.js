let logger = require('log4js');
let logDebug = logger.getLogger('webSocket');
module.exports = class SendFromSocket{
    constructor(socket,chainType){
        this.socket = socket;
        this.chainType = chainType;
    }
    close(){
        this.socket.close();
    }
    send(trans,password,callback){
        logDebug.debug(trans.trans);
        let rawTx = trans.signFromKeystore(password);
        logDebug.debug('rawTx:',rawTx);
        if(rawTx){
            this.socket.sendMessage('sendRawTransaction',rawTx,this.chainType,callback);
        }
        else{
            callback({error:'wrong password'},null);
        }
    }
    hasMessage(msg){
        return this.socket.messageFactory[msg];
    }
    sendMessage(...args){
        let args1 = args;
        var nLen = args.length-1;
        args1.splice(nLen,0,this.chainType);
        this.socket.sendMessage(...args1);
    }
    /*
    sendRawTrans(rawTx,callback){
        if(rawTx){
            this.socket.sendMessage('sendRawTransaction',rawTx,this.chainType,callback);
        }
        else{
            callback({error:'wrong password'},null);
        }
    }
    getCrossEthScAddress(callBack){
        this.socket.sendMessage('getCrossEthScAddress',this.chainType,callBack);
    }
    getStoremanGroups(callBack){
        this.socket.sendMessage('SyncStoremanGroups',this.chainType,callBack);
    }
    getBalance(address,callBack){
        this.socket.sendMessage('getBalance',address,this.chainType,callBack);
    }
    getMultiBalances(address,callBack){
        this.socket.sendMessage('getMultiBalances',address,this.chainType,callBack);
    }
    getMultiTokenBalance(address,callBack){
        this.socket.sendMessage('getMultiTokenBalance',address,this.chainType,callBack);
    }
    getGasPrice(callBack){
        this.socket.sendMessage('getGasPrice',this.chainType,callBack);
    }

    getNonce(address,callBack){
        this.socket.sendMessage('getNonce',address,this.chainType,callBack);
    }
    getBlockNumber(callBack){
        this.socket.sendMessage('getBlockNumber',this.chainType,callBack);
    }
    getGasPrice(callBack){
        this.socket.sendMessage('getGasPrice',this.chainType,callBack);
    }
    getScEvent(address,topics,callBack){
        this.socket.sendMessage('getScEvent',address,topics,this.chainType,callBack);
    }
    monitorLog(address,topics,callBack){
        this.socket.sendMessage('monitorLog',address,topics,this.chainType,callBack);
    }
    */
}
