let wanUtil = require('wanchain-util');
const secp256k1 = require('secp256k1');
class IOTAAddress{
    constructor()
    {
        this.address = null;
        this.waddress = null;
        this.privateKey = null;
    }
    getOTAPrivateKey(privateKey)
    {
        if (privateKey.AKey) {
            this.privateKey = wanUtil.computeWaddrPrivateKey(this.waddress, privateKey.AKey, privateKey.BKey);
        }
    }
    getPublicKey()
    {
        return wanUtil.recoverPubkeyFromWaddress(this.waddress);
    }
    generateRingSign(message,otaSet)
    {
        let otaSetBuf = [];
        for (let i = 0; i < otaSet.length; i++) {
            let rpkc = new Buffer(otaSet[i].slice(2, 68), 'hex');
            let rpcu = secp256k1.publicKeyConvert(rpkc, false);
            otaSetBuf.push(rpcu);
        }
        let publicKey = this.getPublicKey().A;
        let ringArgs = wanUtil.getRingSign(message, this.privateKey, publicKey, otaSetBuf);
        let KIWQ = this.generatePubkeyIWQforRing(ringArgs.PubKeys, ringArgs.I, ringArgs.w, ringArgs.q);
        return KIWQ;
    }
    generatePubkeyIWQforRing(Pubs, I, w, q){
        let length = Pubs.length;
        let sPubs  = [];
        for(let i=0; i<length; i++){
            sPubs.push(Pubs[i].toString('hex'));
        }
        let ssPubs = sPubs.join('&');
        let ssI = I.toString('hex');
        let sw  = [];
        for(let i=0; i<length; i++){
            sw.push('0x'+w[i].toString('hex').replace(/(^0*)/g,""));
        }
        let ssw = sw.join('&');
        let sq  = [];
        for(let i=0; i<length; i++){
            sq.push('0x'+q[i].toString('hex').replace(/(^0*)/g,""));
        }
        let ssq = sq.join('&');

        let KWQ = [ssPubs,ssI,ssw,ssq].join('+');
        return KWQ;
    }
}
class CreateOTAAddress extends IOTAAddress{
    constructor(waddress) {
        super();
        this.waddress = wanUtil.generateOTAWaddress(waddress).toLowerCase();
    }
}
class ownOTAAddress extends IOTAAddress{
    constructor(OTAaddress) {
        super();
        this.waddress = OTAaddress;
    }
    getRingSignData(address,privateKey,OTAset)
    {
        let M = new Buffer(address.slice(2), 'hex');
        this.getOTAPrivateKey(privateKey);
        return this.generateRingSign(M,OTAset);
    }
}
class ownCreateOTAAddress extends ownOTAAddress
{
    constructor(waddress)
    {
        super(wanUtil.generateOTAWaddress(waddress).toLowerCase());
    }
}


exports.CreateOTAAddress = CreateOTAAddress;
exports.ownOTAAddress = ownOTAAddress;
exports.ownCreateOTAAddress = ownCreateOTAAddress;