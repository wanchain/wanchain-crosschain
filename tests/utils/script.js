
function checkHash(hash) {
    if (hash === null) {
        return false;
    }

    return (/^(0x)?[0-9a-fA-F]{64}$/i.test(hash));
}

let timeStamp2String = function (time){
    let datetime = new Date();
    datetime.setTime(time);

    let year = datetime.getFullYear();

    let month = datetime.getMonth() + 1;
    if (month <10) month = '0' + month.toString();

    let date = datetime.getDate();
    if (date <10) date = '0' + date.toString();

    let hour = datetime.getHours();
    if (hour <10) hour = '0' + hour.toString();

    let minute = datetime.getMinutes();
    if (minute <10) minute = '0' + minute.toString();

    let second = datetime.getSeconds();
    if (second <10) second = '0' + second.toString();

    return year + "-" + month + "-" + date+" "+hour+":"+minute+":"+second;
};

let checkTransaction = (records, web3, hash160ToAddress) => {
    let showArray = [];

    records.forEach(function (array) {
        if (array.crossAddress === '') {
            return;
        }

        showArray.push(array);
    });

    showArray.forEach(function(Array, index){

        if (Array.chain.toLowerCase() === 'btc') {
            Array.valueStr = web3.toBigNumber(Array.value).div(100000000) + ' BTC';
            if(Array.crossAddress) {
                Array.destAddr = '0x' + Array.crossAddress;
            } else {
                //Add for normal btc tx display.
                Array.destAddr = Array.to;
                Array.status = 'success';
            }
        }else{
	        Array.valueStr = web3.toBigNumber(Array.value).div(100000000) + ' WBTC';
            Array.destAddr = hash160ToAddress(Array.crossAddress, 'pubkeyhash','testnet');
        }

        Array.timeStr = timeStamp2String(Array.time);
        Array.HTLCtimeStr = timeStamp2String(Array.HTLCtime);
    });


    return showArray;
};

module.exports = {checkHash, timeStamp2String, checkTransaction};