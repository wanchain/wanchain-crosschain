//var btcwork = require('./btcwork.js');
//var common = require('./common.js')

const WanchainCore = require('./walletCore.js');
let wanchainCore;
let ccUtil;
let btcUtil;

async function init(){
        wanchainCore = new WanchainCore({});
        ccUtil = wanchainCore.be;
        btcUtil = wanchainCore.btcUtil;
}
main();

async function main() {
    await init();
    let msgSubObj = {"storeman":"0xd3a80a8e8bf8fbfea8eee3193dc834e61f257dfe","userWanAddr":"0xbd100cf8286136659a7d63a38a154e28dbf3e0fd","xHash":[123,117,30,25,118,163,74,6,12,155,21,97,72,44,106,80,211,67,86,17,135,193,143,13,181,45,168,139,221,49,243,198],"txHash":[24,140,159,182,243,121,107,98,136,163,8,167,189,91,61,234,209,64,4,60,164,41,82,209,125,79,92,189,41,136,200,84],"lockedTimestamp":50966};
    //var msgSubObj = JSON.parse(subObjStr);
    let xHashBuf = new Buffer(msgSubObj.xHash);
    console.log("xHashBuf:", xHashBuf);
    let txHashBuf = new Buffer(msgSubObj.txHash);
    console.log("txHash:", txHashBuf);

    let value = await ccUtil._verifyBtcUtxo(msgSubObj.storeman, txHashBuf.toString('hex'), xHashBuf.toString('hex'), msgSubObj.lockedTimestamp)

    console.log("value: ", value);
}


