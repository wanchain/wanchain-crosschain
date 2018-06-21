"use strict";

let wandb = require('./newDb.js');
module.exports = {
    databaseAry : {},
    useDatabase(filepath,dbDefineArray){
        for(var i = 0;i<dbDefineArray.length;++i){
            let dbDefine = dbDefineArray[i];
            this.databaseAry[dbDefine.name] = new wandb(filepath,dbDefine);
        }
    },
    getCollection(dbName,collectionName){
        if(this.databaseAry[dbName]){
            return this.databaseAry[dbName].collections.getCollection(collectionName);
        }
        return null
    },
    initDatabaseGroup(){
        for (var key in this.databaseAry) {
            this.databaseAry[key].init();
        }
    },
    size(){
        return Object.keys(this.databaseAry).length;
    }
}