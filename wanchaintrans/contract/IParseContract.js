module.exports = class IParseContract{
    constructor(IContract) {
        this.contract = IContract;
        this.contract.initParse();
    }
    check(data){
        if(data.slice(0,2) == '0x' || data.slice(0,2) == '0X') {
            data = data.slice(2);
        }
        if(this.checkFunction(data)){
            this.contract.dict = null;
            this.parseData(data.slice(8));
            return this.contract.dict.length != this.contract.input.format.length;
        }else {
            return false;
        }
    }
    setInput(input)
    {
        this.contract.input = input;
    }
    parseData(data)
    {

        if(data.slice(0,2) == '0x' || data.slice(0,2) == '0X'){
            data = data.slice(2);
        }
        this.contract.dict = this.contract.parseContractMethodPara(data);
    }
    checkFunction(data){
        if(data.slice(0,2) == '0x' || data.slice(0,2) == '0X'){
            data = data.slice(2);
        }
        let cmd = data.slice(0, 8).toString('hex');
        return cmd == this.contract.cmdCode;
    }
}