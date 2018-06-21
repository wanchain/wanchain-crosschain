"use strict";

let collection = require('./collection.js');
module.exports = class wanCollections{
    constructor(db,CollectionAry) {
        this.Collections = {};
        this.addCollections(db,CollectionAry);
    }
    addCollections(db,CollectionAry)
    {
        let self = this;
        for(var i = 0;i<CollectionAry.length;++i)
        {
            let item = CollectionAry[i];
            if(!self.Collections.hasOwnProperty(item.name))
                self.Collections[item.name] = new collection(db,item.name,item.UID,item.ItemDefine);
        }
    }
    getCollection(name){
        if(this.Collections.hasOwnProperty(name)){
            return this.Collections[name].getCollection();
        }
        return null;
    }
}