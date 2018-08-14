const bitcoin  = require('bitcoinjs-lib');
var bip65 = require('bip65');

const config = require('../../config.js');
const Client = require('bitcoin-core');
const client = new Client(config.server.regtest);

const network = bitcoin.networks.testnet;

FEE = 0.001

var alice = bitcoin.ECPair.fromWIF(
	'cPbcvQW16faWQyAJD5sJ67acMtniFyodhvCZ4bqUnKyjataXKLd5', bitcoin.networks.testnet
	);
var bob = bitcoin.ECPair.fromWIF(
	'cTgR2GrYrH3Z9UULxGEpfAhM4mAsmFRAULUwp5KYFM9R9khxYJ4v', bitcoin.networks.testnet
	);

function getAddress(keypair){
	pkh = bitcoin.payments.p2pkh({pubkey: keypair.publicKey, network: bitcoin.networks.testnet});
	return pkh.address;
}

secret = 'LgsQ5Y89f3IVkyGJ6UeRnEPT4Aum7Hvz';
commitment = 'bf19f1b16bea379e6c3978920afabb506a6694179464355191d9a7f76ab79483';

print4debug = console.log;
print4debug = function() {}

async function findOneTxToAddress(dest){
	txs = await client.listUnspent(0,  1000000, [dest]);
	// print4debug('find dest: ' + dest);
	for(i = 0; i < txs.length; i++){
		tx = txs[i];		
		if(dest === tx['address']){
			print4debug(JSON.stringify(tx, null, 4));
			return tx
		}
	}
	return null
}


async function hashtimelockcontract(commitment, locktime){
	blocknum = await client.getBlockCount();
	print4debug("blocknum:" + blocknum);
    print4debug("Current blocknum on Bitcoin: " + blocknum);
    redeemblocknum = blocknum + locktime;
    print4debug("Redeemblocknum on Bitcoin: " + redeemblocknum);

    redeemScript = bitcoin.script.compile([
        /* MAIN IF BRANCH */
        bitcoin.opcodes.OP_IF,
        bitcoin.opcodes.OP_SHA256,
        Buffer.from(commitment, 'hex'),
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,

        bitcoin.crypto.hash160(bob.publicKey),//bob.getPublicKeyBuffer(),// redeemer address                
        bitcoin.opcodes.OP_ELSE,
        bitcoin.script.number.encode(redeemblocknum),
        bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY,
        bitcoin.opcodes.OP_DROP,
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,

        bitcoin.crypto.hash160(alice.publicKey),//alice.getPublicKeyBuffer(), // funder addr
        /* ALMOST THE END. */
        bitcoin.opcodes.OP_ENDIF,

        // Complete the signature check.
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_CHECKSIG
    ]);   
    print4debug(redeemScript.toString('hex')); 
    //var scriptPubKey = bitcoin.script.scriptHash.output.encode(bitcoin.crypto.hash160(redeemScript));
    //var address = bitcoin.address.fromOutputScript(scriptPubKey, network)

    var address = bitcoin.payments.p2sh({ redeem: { output: redeemScript, network: network }, network: network })
    var address = address.address    

    await client.importAddress(address, "");
    
    return {
    	'p2sh': address,
    	'redeemblocknum' : redeemblocknum,
    	'redeemScript': redeemScript,
    	'locktime': locktime
    }

}

async function fundHtlc(p2sh, amount){    
	// await client.setTxFee(0.001);
	txid = await client.sendToAddress(p2sh, amount);
	return txid;
}


// implicit redeem by bob
async function redeem(contract, fundtx, secret){
	redeemScript = contract['redeemScript'];

	var txb = new bitcoin.TransactionBuilder(network);
	txb.setVersion(1);
	print4debug('----W----A----N----C----H----A----I----N----');
	print4debug(JSON.stringify(fundtx))
	print4debug('----W----A----N----C----H----A----I----N----');
	txb.addInput(fundtx.txid, fundtx.vout);
	txb.addOutput(getAddress(bob), (fundtx.amount-FEE)*100000000);

	const tx = txb.buildIncomplete()
	const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

	const redeemScriptSig = bitcoin.payments.p2sh({
		redeem: {
			input: bitcoin.script.compile([
				bitcoin.script.signature.encode(bob.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
				bob.publicKey,
				Buffer.from(secret, 'utf-8'),
				bitcoin.opcodes.OP_TRUE
				]),
			output: redeemScript,
		},
		network: bitcoin.networks.regtest
	}).input
	tx.setInputScript(0, redeemScriptSig);
	print4debug("redeem raw tx: \n" + tx.toHex());
	txid = await client.sendRawTransaction(tx.toHex(), 
		function(err){print4debug(err);}
	);
	print4debug("redeem tx id:" + txid);
}


async function refund(contract, fundtx){
	person = alice;// can change person to bob will failed
	redeemScript = contract['redeemScript'];

	var txb = new bitcoin.TransactionBuilder(network);
	txb.setLockTime(contract['redeemblocknum']);
	txb.setVersion(1);
	txb.addInput(fundtx.txid, fundtx.vout, 0);
	txb.addOutput(getAddress(person), (fundtx.amount-FEE)*100000000);

	const tx = txb.buildIncomplete();
	const sigHash = tx.hashForSignature(0, redeemScript, bitcoin.Transaction.SIGHASH_ALL);

	const redeemScriptSig = bitcoin.payments.p2sh({
		redeem: {
			input: bitcoin.script.compile([
				bitcoin.script.signature.encode(person.sign(sigHash), bitcoin.Transaction.SIGHASH_ALL),
				person.publicKey,
				bitcoin.opcodes.OP_FALSE
				]),
			output: redeemScript
		}
	}).input;

	tx.setInputScript(0, redeemScriptSig);
	print4debug("refund raw tx: \n" + tx.toHex());

	await client.sendRawTransaction(tx.toHex(), 
		function(err){print4debug(err);}
	);
}

async function testRefund(){
	contract = await hashtimelockcontract(commitment, 10);

	await fundHtlc(contract['p2sh'], 16);
	fundtx = await findOneTxToAddress(contract['p2sh']);
	print4debug("fundtx:" + JSON.stringify(fundtx, null, 4));

    await client.generate(66);
	await refund(contract, fundtx);
}

async function testRedeem(){

	contract = await hashtimelockcontract(commitment, 10);

	await fundHtlc(contract['p2sh'], 16);
	fundtx = await findOneTxToAddress(contract['p2sh']);
	print4debug("fundtx:" + JSON.stringify(fundtx, null, 4));

	await redeem(contract, fundtx, secret);
}

async function showBalance(info){
    aliceBalance = await client.getReceivedByAddress(getAddress(alice), 0);
    bobBalance = await client.getReceivedByAddress(getAddress(bob), 0);
    console.log(info + " alice Balance: " + aliceBalance);
    console.log(info + " bob   Balance: " + bobBalance);
}


async function main(){
	await client.generate(1);

	await client.importAddress(getAddress(alice), "");
	await client.importAddress(getAddress(bob), "");

	showBalance('Begin');

	await testRedeem();

	showBalance('End');
}


main();