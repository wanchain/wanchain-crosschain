"use strict";

let socketmessage = require("../wanchainsender/index.js").socketmessage;
module.exports = {
    chainType : ["WAN","ETH"],
    syncStoremanGroups(chainType,callBack) {
        return new socketmessage('syncStoremanGroups',{crossChain:'ETH'},'storemanGroup',chainType,callBack);
    },
    getBalance(address,chainType,callBack){
        return new socketmessage('getBalance',{address:address},'balance',chainType,callBack);
    },
    getMultiBalances(address,chainType,callBack){
        return new socketmessage('getMultiBalances',{address:address},'balance',chainType,callBack);
    },
    getMultiTokenBalance(address,chainType,callBack){
        return new socketmessage('getMultiTokenBalance',{address:address, tokenScAddr:global.config.WBTCToken},'tokenBalance',chainType,callBack);
    },
    getGasPrice(chainType, callBack){
        return new socketmessage('getGasPrice',{}, "gasPrice", chainType, callBack);
    },
    getBlockByNumber(blockNumber, chainType, callBack){
        return new socketmessage('getBlockByNumber',{blockNumber:blockNumber}, "block", chainType, callBack);
    },
    getTransactionReceipt(txHash,chainType,callBack){
        return new socketmessage('getTransactionReceipt',{txHash:txHash},'receipt',chainType,callBack);
    },
    getTxInfo(txHash,chainType,callBack){
        return new socketmessage('getTxInfo',{txHash:txHash},'txInfo',chainType,callBack);
    },
    getNonce(address,chainType,callBack){
        return new socketmessage('getNonceIncludePending',{address:address},'nonce',chainType,callBack);
    },
    getBlockNumber(chainType,callBack){
        return new socketmessage('getBlockNumber',{},'blockNumber',chainType,callBack);
    },
    getCrossEthScAddress(chainType,callBack){
        return new socketmessage('getCrossEthScAddress',{},'groupAddr',chainType,callBack);
    },
    sendRawTransaction(signedTx,chainType,callBack){
        return new socketmessage('sendRawTransaction',{signedTx:signedTx},'txHash',chainType,callBack);
    },
    getScEvent(address,topics,chainType,callBack){
        return new socketmessage('getScEvent',{address:address,topics:topics},'logs',chainType,callBack);
    },
    callScFunc(scAddr, name,args,abi,chainType,callBack){
        return new socketmessage('callScFunc',{scAddr:scAddr,name:name,args:args,abi:abi},'value',chainType,callBack);
    },
    getScVar( scAddr, name,abi,chainType,callBack){
        return new socketmessage('getScVar',{scAddr:scAddr, name:name,abi:abi},'value',chainType,callBack);
    },
    getCoin2WanRatio(crossChain, chainType, callBack){
        return new socketmessage('getCoin2WanRatio',{crossChain:crossChain},'c2wRatio',chainType,callBack);
    },
    getUTXO(minconf, maxconf, addresses, chainType, callBack){
        return new socketmessage('getUTXO',{minconf:minconf, maxconf:maxconf, addresses:addresses},'UTXOs',chainType,callBack);
    },
    monitorLog(address,topics,chainType,callBack){
        return new socketmessage('monitorLog',{address:address,topics:topics},'logs',chainType,callBack);
    },
    getTransactionConfirm(txHash,waitBlocks, chainType,callBack){
        return new socketmessage('getTransactionConfirm',{txHash:txHash, waitBlocks:waitBlocks},'receipt',chainType,callBack);
    },
}
