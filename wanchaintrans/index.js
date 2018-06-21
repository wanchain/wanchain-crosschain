exports.IContract = require('./contract/IContract.js');
exports.IParseContract = require('./contract/IParseContract.js');
exports.tokenContract = require('./contract/tokenContract.js');
exports.wanContract = require('./contract/wanContract.js').wanContract;
exports.PrivacyContract = require('./contract/wanContract.js').PrivacyContract;
exports.refundOTAContract = require('./contract/wanContract.js').refundOTAContract;
exports.stampContract = require('./contract/wanContract.js').stampContract;

exports.hashContract = require('./cross_contract/hashContract.js');

exports.hashXSend = require('./cross_transactions/hashXSend.js');
exports.ethHashXSend = require('./cross_transactions/ethHashXSend.js');
exports.wanHashXSend = require('./cross_transactions/wanHashXSend.js');
exports.NormalSend = require('./interface/transaction.js').NormalSend;
exports.CoinAmount = require('./interface/Amount.js').CoinAmount;
exports.GWeiAmount = require('./interface/Amount.js').GWeiAmount;
