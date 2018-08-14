'use strict';

const WanchainCore = require('../walletCore.js');
const config = require('../config.js');
let ccUtil;
describe('btc api test', ()=>{
    before(async ()=>{
        let wanchainCore = new WanchainCore(config);
        ccUtil = wanchainCore.be;
        await wanchainCore.init(config);
    });
    it('TC001: get utxo of a random address', ()=>{
        console.log("start");
        const addrs = ["mkuNvfqgGM3EEWkYNEMxP4KzzDWfXc5cEX"];
        ccUtil.getBtcUtxo(ccUtil.btcSender, addrs);
    });

    it('end', ()=>{
        console.log("end");
    });
})

