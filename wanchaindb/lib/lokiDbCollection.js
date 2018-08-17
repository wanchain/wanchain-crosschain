"use strict";

const loki = require('lokijs');
const fs=require('fs');
const path=require('path');

function mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

let btcDbPath;
if (process.platform === 'darwin') {
    mkdirsSync(path.join(process.env.HOME, '/Library/bitcoin/testnet/db/'));
    btcDbPath = path.join(process.env.HOME, '/Library/bitcoin/testnet/db/');
}else if (process.platform === 'win32') {
    mkdirsSync(path.join(process.env.APPDATA, 'bitcoin/testnet/db\\'));
    btcDbPath = path.join(process.env.APPDATA, 'bitcoin/testnet/db\\');
} else {
    mkdirsSync(path.join(process.env.HOME, '.bitcoin/testnet/db/'));
    btcDbPath = path.join(process.env.HOME, '.bitcoin/testnet/db/');
}

let db = new loki(path.join(btcDbPath, 'btc.db'), {
    autoload: true,
    autoloadCallback : databaseInitialize,
    autosave: true,
    autosaveInterval: 4000
});

function databaseInitialize() {
    const btcAddress = db.getCollection('btcAddress');
    if (btcAddress === null) {
        db.addCollection('btcAddress')
    }
}

function loadCollection(collection) { //调用数据的方法
    return new Promise(resolve => {
        db.loadDatabase({}, () => {
            const _collection = db.getCollection(collection) || db.addCollection(collection);
            resolve(_collection)
        })
    })
}

module.exports = {btcDb: db, loadCollection: loadCollection};
