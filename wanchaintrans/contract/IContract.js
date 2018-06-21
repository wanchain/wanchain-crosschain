const solc = require('solc');
const fs = require('fs');
let wanUtil = require('wanchain-util');
const SolidityCoder = require('web3/lib/solidity/coder');
let web3 = require('../web3/initWeb3.js');
module.exports = class IContract {
    constructor(abi,contractFunc,contractAddr) {
        this.Abi = abi;
        this.contractFunc = contractFunc;
        if(contractAddr){
            this.setcontractAddress(contractAddr);
        }
    }
    setFromSolFile(solFile,tokenName,contractFunc,contractAddr) {
        this.getAbiFromFile(solFile, tokenName);
        this.contractFunc = contractFunc;
        this.setcontractAddress(contractAddr);
    }
    setcontractAddress(contractAddr)
    {
        if(/^0x[0-9a-f]{40}$/i.test(contractAddr))
        {
            this.contractAddr = contractAddr;
        }
    }
    setAbiFromFile(tokenFile,tokenName)
    {
        let compile = this.compileSol(tokenFile);
        this.Abi = this.getAbi(compile,tokenName);
    }
    compileSol(tokenFile)
    {
        let content = fs.readFileSync(tokenFile, 'utf8');
        return solc.compile(content, 1);
    }
    getAbi(compileSol,tokenName)
    {
        return JSON.parse(compileSol.contracts[':'+tokenName].interface);
    }
    getFuncInterface(funcName){
        let Contract = web3.eth.contract(this.Abi);
        let conInstance = Contract.at(this.contractAddr);
        return conInstance[funcName];
    }
    getSolInferface(){
        this.getFuncInterface(this.contractFunc);
    }
    initParse()
    {
        if(this.Abi)
        {
            if(this.contractFunc){
                this.input = this.getInput(this.Abi,this.contractFunc);
                this.cmdCode = this.getCmdCode(this.contractFunc,this.input);
            }
        }
    }
    getcommandString(funcName){
        for(var i = 0;i<this.Abi.length;++i){
            let item = this.Abi[i];
            if(item.name == funcName){
                let command = funcName + '(';
                for(var j=0;j<item.inputs.length;++j)
                {
                    if(j!=0)
                    {
                        command = command + ',';
                    }
                    command = command + item.inputs[j].type;
                }
                command = command + ')';
                return command;
            }
        }
    }
    commandSha3(command){
        return wanUtil.sha3(command, 256);
    }
    getFunctionCode(funcName){
        return this.commandSha3(this.getcommandString(funcName)).slice(0,4).toString('hex');
    }
    getEventCode(funcName){
        return '0x' + this.commandSha3(this.getcommandString(funcName)).toString('hex');
    }
    getCmdCode(funcName,input){
        let command = funcName+'(';
        for(var i=0;i<input.format.length;++i)
        {
            if(i!=0)
            {
                command = command + ',';
            }
            command = command + input.format[i];
        }
        command = command + ')';
        return this.commandSha3(command).slice(0,4).toString('hex');
    }

    getInput(abi, method)
    {
        let input = {inputs : [],format:[]};
        for(var i= 0; i<abi.length; ++i){
            if(abi[i].name == method){
                input.inputs = abi[i].inputs;
                break;
            }
        }
        if(input.inputs.length) {
            for (let j = 0; j < input.inputs.length; j++) {
                if(!input.inputs[j].indexed){
                    input.format.push(input.inputs[j].type);
                }
            }
        }
        return input;
    }
    parseContractMethodPara(paraData) {
        var dict = {};
        let paras = SolidityCoder.decodeParams(this.input.format,paraData);
        for(let j=0,k=0; k<this.input.inputs.length && j<paras.length; k++){
            if(this.input.inputs[k].indexed)
                continue;
            dict[this.input.inputs[k].name] = paras[j];
            ++j;
        }
        return dict;
    }
}