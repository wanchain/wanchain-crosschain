"use strict";

module.exports = class wanCollection{
    constructor(db,collectionName,UID,ItemDefine) {
        this.db = db;
        this.collectionName = collectionName;
        this.UID = UID;
        this.collection = null;
        this.ItemDefine = ItemDefine;
    }
    getCollection(){
        // if(this.collection)
        //     return this.collection;
        // else{
            this.collection = this.db.getCollection(this.collectionName,this.UID);
            return this.collection;
        // }
    }
    getAutoIncrementUID()
    {
        var result = this.collection.maxRecord(this.UID);
        if(result && result.value)
        {
            return result.value + 1;
        }
        else
        {
            return 1;
        }
    }
    getItemDefine(){
        return this.cloneItem(this.ItemDefine);
    }
    cloneItem(item) {
        var newItem = {};
        for (var key in item) {
            if(this.ItemDefine.hasOwnProperty(key)){
                newItem[key] = item[key];
            }
        }
        return newItem;
    };
}
