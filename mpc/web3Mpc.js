
"use strict"

module.exports = {
    extend: (web3) => {
        function insertMethod(name, call, params, inputFormatter, outputFormatter) {
            return new web3._extend.Method({ name, call, params, inputFormatter, outputFormatter });
        }

        function insertProperty(name, getter, outputFormatter) {
            return new web3._extend.Property({ name, getter, outputFormatter });
        }

        web3._extend({
            property: 'storeman',
            methods:
                [
                    insertMethod('addValidMpcTxRaw', 'storeman_addValidMpcTxRaw', 1, [null], null),
                    insertMethod('signMpcBtcTransaction', 'storeman_signMpcBtcTransaction', 1, [null], null),
                ],
            properties:[],
        });
    }
};

