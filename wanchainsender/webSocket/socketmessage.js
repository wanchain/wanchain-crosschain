"use strict";

let index = 0;
let logDebug;
module.exports = class socketmessage{
    constructor(action,parameters,result,chainType,callBack){
        this.message = {
            header : {chain : chainType,action:action,index:index},
            action : action,
            parameters : parameters,
        }
        logDebug = global.getLogger('socketmessage');
        this.message.parameters.chainType = chainType;
        this.result = result;
        this.callback = callBack;
        ++index;
    }
    isSuccess(result){
        return result.status == 'success';
    }
    onMessage(message){
        logDebug.debug(message);
        if(this.isSuccess(message)){
            logDebug.debug(message[this.result]);
            if(this.callback){
                this.callback(null,message[this.result]);
            }
        }
        else
        {
            logDebug.debug(message);
            if(this.callback){
                this.callback(message.error,null);
            }
        }
    }


}