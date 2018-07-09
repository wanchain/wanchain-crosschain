"use strict";

let BigNumber = require('bignumber.js');
class IAmount{
    constructor(amount,exp)
    {
        this.amount = amount;
        this.exp = exp;
        let amount1 = new BigNumber(this.amount);
        let exp1 = new BigNumber(10);
        this.wei = amount1.times(exp1.pow(this.exp));
    }
    getWei()
    {
        return '0x' + this.wei.toString(16);
    }
    getAmount()
    {
        return this.amount;
    }
    isEqualWei(wei)
    {
        return this.wei.equals(wei);
    }
    addWei(wei)
    {
        this.wei = this.wei.plus(wei);
        let exp = new BigNumber(10);
        this.amount = this.wei.dividedBy(exp.pow(this.exp));
    }
    subWei(wei)
    {
        this.wei = this.wei.sub(wei);
        let exp = new BigNumber(10);
        this.amount = this.wei.dividedBy(exp.pow(this.exp));
    }
}
class GWeiAmount extends IAmount{
    constructor(amount){
        super(amount,9);
    }
}
class CoinAmount extends IAmount{
    constructor(amount){
        super(amount,18)
    }
}
exports.GWeiAmount = GWeiAmount;
exports.CoinAmount = CoinAmount;