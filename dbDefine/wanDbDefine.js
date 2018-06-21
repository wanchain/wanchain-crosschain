"use strict";

module.exports = {
    name : 'wanchain',
    collections : [
        {
            name : 'transaction',
            UID : 'transHash',
            ItemDefine : {
                transHash : '',
                from : '',
                to : '',
                value : '',
                time : '',
                Type : ''
            }
        },
    ]

}