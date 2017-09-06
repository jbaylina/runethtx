const Web3PromiEvent = require("web3-core-promievent");
const utils = require("web3-utils");

utils.fireError = utils._fireError; // eslint-disable-line no-underscore-dangle

module.exports = {
    sendContractTx,
    sendTx,
    getBalance,
    getTransactionReceipt,
    getBlock,
    deploy,
    asyncfunc,
    generateClass,
};

const getParamNames = inputs => inputs.map((param) => {
    if (param.name[ 0 ] === "_") {
        return param.name.substring(1);
    }
    return param.name;
});

const estimateGas = (web3, method, opts) => {
    if (opts.$noEstimateGas) return Promise.resolve(4700000);
    if (opts.$gas) return Promise.resolve(opts.$gas);

    return method.estimateGas({
        value: opts.$value || 0,
        gas: 4700000,
        from: opts.$from,
    }).then((_gas) => {
        if (_gas >= 4700000) throw new Error(`gas limit reached: ${ _gas }`);

        if (opts.$verbose) console.log("Gas: " + _gas); // eslint-disable-line no-console

        return opts.$extraGas ? _gas + opts.$extraGas : _gas + 10000;
    });
};

const getAccount = (web3, opts) => {
    if (opts.$from) {
        return Promise.resolve(opts.$from);
    }
    return web3.eth.getAccounts()
        .then((_accounts) => {
            if (_accounts.length === 0) throw new Error("No account available");

            return _accounts[ 0 ];
        }).catch((err) => {
            console.log("xxxxx -> " + err); // eslint-disable-line no-console
            throw err;
        });
};

function sendMethodTx(web3, defer, method, opts) {
    const relayEvent = event => (...args) => defer.eventEmitter.emit(event, ...args);

    const txParams = {
        value: opts.$value || 0,
    };

    if (opts.$gasPrice) txParams.gasPrice = opts.$gasPrice;

    getAccount(web3, opts)
        .then((account) => {
            txParams.from = account;
            return estimateGas(web3, method, Object.assign({}, opts, { $from: account }));
        })
        .catch((err) => {
            // make sure 'error' event is emitted
            utils.fireError(err, defer.eventEmitter, defer.reject);
            throw err;
        })
        .then(gas => method.send({
            gas,
            ...txParams,
        })
            // relay all events to our promiEvent
            .on("transactionHash", relayEvent("transactionHash"))
            .on("confirmation", relayEvent("confirmation"))
            .on("receipt", relayEvent("receipt"))
            .on("error", relayEvent("error")),
        )
        .then(defer.resolve)
        .catch(defer.reject);
}

function deploy(web3, { $abi, $byteCode, ...opts }, _cb) {
    return asyncfunc(() => {
        const defer = Web3PromiEvent();

        const fireError = err => utils.fireError(err, defer.eventEmitter, defer.reject);

        try {
            checkWeb3(web3);
        } catch (e) {
            return fireError(e);
        }

        const constructorAbi = $abi.find(({ type }) => (type === "constructor"));

        const paramNames = (constructorAbi) ? getParamNames(constructorAbi.inputs) : [];
        const params = paramNames.map(name => opts[ name ]);

        if (opts.$verbose) console.log("constructor: " + JSON.stringify(params)); // eslint-disable-line no-console

        const ctr = new web3.eth.Contract($abi).deploy({
            data: $byteCode,
            arguments: params,
        });

        sendMethodTx(web3, defer, ctr, opts);

        return defer.eventEmitter;
    }, _cb);
}

function asyncfunc(f, cb) {
    const promise = f();

    if (cb) {
        if (promise.on) {
            // this is a send tx.
            promise
                .on("transactionHash", _txHash => cb(null, _txHash))
                .then(_txReceipt => cb(null, null, _txReceipt))
                .catch(cb);
        } else {
            // this is a call tx. we want to return the result
            promise.then(value => cb(null, value), cb);
        }
    } else {
        return promise;
    }
}

function getBalance(web3, address, cb) {
    checkWeb3(web3);
    return web3.eth.getBalance(address, cb);
}

function getTransactionReceipt(web3, txHash, cb) {
    checkWeb3(web3);
    return web3.eth.getTransactionReceipt(txHash, cb);
}

function getBlock(web3, blockNumber, cb) {
    checkWeb3(web3);
    return web3.eth.getBlock(blockNumber, cb);
}

function sendTx(web3, { data, from, value, gasPrice, nonce, to, ...opts }, _cb) {
    return asyncfunc(() => {
        const defer = Web3PromiEvent();

        const fireError = err => utils.fireError(err, defer.eventEmitter, defer.reject);

        const relayEvent = event => (...args) => defer.eventEmitter.emit(event, ...args);

        try {
            checkWeb3(web3);
        } catch (e) {
            return fireError(e);
        }

        const txOpts = {};

        if (!to) return fireError(new Error("to is required"));

        txOpts.to = to;
        txOpts.value = value || 0;
        if (gasPrice) txOpts.gasPrice = gasPrice;
        if (nonce) txOpts.nonce = nonce;
        if (data) txOpts.data = data;

        const _estimateGas = () => { // eslint-disable-line no-underscore-dangle
            if (opts.$noEstimateGas) return Promise.resolve(4700000);
            if (opts.gas) return Promise.resolve(opts.gas);

            return web3.eth.estimateGas(txOpts)
                .then((gas) => {
                    if (gas >= 4700000) throw new Error(`gas limit reached: ${ gas }`);

                    if (opts.$verbose) console.log("Gas: " + gas); // eslint-disable-line no-console

                    return (opts.$extraGas) ? gas + opts.$extraGas : gas + 10000;
                });
        };

        getAccount(web3, { $from: from })
            .then((account) => {
                txOpts.from = account;
                return _estimateGas();
            })
            .catch((err) => {
                fireError(err); // make sure 'error' event is emitted
                throw err;
            })
            .then((gas) => {
                txOpts.gas = gas;

                if (opts.$verbose) console.log("sendTx: " + JSON.stringify(txOpts)); // eslint-disable-line no-console

                return web3.eth.sendTransaction({ ...txOpts })
                    // relay all events to our promiEvent
                    .on("transactionHash", relayEvent("transactionHash"))
                    .on("confirmation", relayEvent("confirmation"))
                    .on("receipt", relayEvent("receipt"))
                    .on("error", relayEvent("error"));
            })
            .then(defer.resolve)
            .catch(defer.reject);

        return defer.eventEmitter;
    }, _cb);
}

function sendContractConstTx(web3, contract, method, opts, _cb) {
    return asyncfunc(() => {
        try {
            checkWeb3(web3);
        } catch (e) {
            return Promise.reject(e);
        }

        if (!contract) return Promise.reject(new Error("Contract not defined"));

        // TODO send raw transaction to the contract.
        if (!method) return Promise.reject(new Error("Method not defined"));

        let errRes;

        const methodAbi = contract.options.jsonInterface.find(({ name, inputs }) => {
            if (name !== method) return false;

            const paramNames = getParamNames(inputs);

            for (let i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[ paramNames[ i ] ] === "undefined") {
                    errRes = new Error("Param " + paramNames[ i ] + " not found.");
                    return false;
                }
            }
            return true;
        });

        if (errRes) return Promise.reject(new Error(errRes));

        if (!methodAbi) return Promise.reject(new Error("Invalid method"));

        const params = getParamNames(methodAbi.inputs).map(name => opts[ name ]);

        try {
            return contract.methods[ method ].apply(null, params).call();
        } catch (e) {
            return Promise.reject(e);
        }
    }, _cb);
}

function sendContractTx(web3, contract, method, opts, _cb) {
    return asyncfunc(() => {
        const defer = Web3PromiEvent();

        // catch is to prevent unhandled exception
        const fireError = err => utils.fireError(err, defer.eventEmitter, defer.reject);

        try {
            checkWeb3(web3);
        } catch (e) {
            return fireError(e);
        }

        if (!contract) return fireError(new Error("Contract not defined"));

        // TODO send raw transaction to the contract.
        if (!method) return fireError(new Error("Method not defined"));

        let errRes;

        const methodAbi = contract.options.jsonInterface.find(({ name, inputs }) => {
            if (name !== method) return false;
            const paramNames = getParamNames(inputs);
            for (let i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[ paramNames[ i ] ] === "undefined") {
                    errRes = new Error("Param " + paramNames[ i ] + " not found.");
                    return false;
                }
            }
            return true;
        });

        if (errRes) return fireError(errRes);

        if (!methodAbi) return fireError(new Error("Invalid method"));

        const params = getParamNames(methodAbi.inputs).map(name => opts[ name ]);

        if (opts.$verbose) console.log(method + ": " + JSON.stringify(params)); // eslint-disable-line no-console

        const m = contract.methods[ method ].apply(null, params);

        sendMethodTx(web3, defer, m, opts);

        return defer.eventEmitter;
    }, _cb);
}

function sendAction(web3, action, contract, method, opts, _cb) {
    return asyncfunc((cb) => {
        if (action.type === "ACCOUNT") {
            const data = getData(contract, method, opts);
        } else if (action.type === "MULTISIG_START") {

        } else if (action.type === "MULTISIG_CONFIRM") {

        } else if (action.type === "MULTISIG_REVOKE") {

        }
    }, cb);
}

function args2opts(_args, inputs) {
    const norm = S => S[ 0 ] == "_" ? S.substring(1) : S;
    const isObject = o => ((typeof o === "object") && (Object.keys(o).sort().join("") != "ces") && !(o instanceof Array));
    const args = _args.slice();
    let opts = {};
    if (typeof args[ args.length - 1 ] === "function") {
        opts.$cb = args.pop();
    }

    for (let i = 0; args.length > 0 && !isObject(args[ 0 ]) && i < inputs.length; i++) {
        opts[ norm(inputs[ i ].name) ] = args.shift();
    }
    while (args.length > 0) {
        const o = args.shift();
        if (!isObject(o)) return null;
        let isOld = false;
        if (o.from) {
            opts.$from = o.from;
            isOld = true;
        }
        if (o.to) {
            opts.$to = o.to;
            isOld = true;
        }
        if (o.gasPrice) {
            opts.$gasPrice = o.gasPrice;
            isOld = true;
        }
        if (o.gas) {
            opts.$gas = o.gas;
            isOld = true;
        }
        if (o.value) {
            opts.$value = o.value;
            isOld = true;
        }
        if (o.nonce) {
            opts.$nonce = o.nonce;
            isOld = true;
        }
        if (!isOld) {
            opts = Object.assign(opts, o);
        }
    }
    return opts;
}

function generateClass(abi, byteCode) {
    let constructorInputs = [];
    const C = function C(web3, address) {
        checkWeb3(web3);
        this.$web3 = web3;
        this.$address = address;
        this.$contract = new this.$web3.eth.Contract(abi, address);
        this.$abi = abi;
        this.$byteCode = byteCode;
    };
    abi.forEach(({ constant, name, inputs, type }) => {
        // TODO overloaded functions
        if (type === "function") {
            const c = function () {
                const args = Array.prototype.slice.call(arguments);
                const self = this;
                const opts = args2opts(args, inputs);
                
                return sendContractConstTx(
                    self.$web3,
                    self.$contract,
                    name,
                    opts,
                    opts.$cb);
            };
            if (!constant) {
                C.prototype[ name ] = function () {
                    const args = Array.prototype.slice.call(arguments);
                    const self = this;
                    const opts = args2opts(args, inputs);

                    return sendContractTx(
                            self.$web3,
                            self.$contract,
                            name,
                            opts,
                            opts.$cb);
                };
            } else {
                C.prototype[ name ] = c;
            }
            C.prototype[ name ].call = c;
        } else if (type === "constructor") {
            constructorInputs = inputs;
        }
    });
    C.new = function (web3) {
        const args = Array.prototype.slice.call(arguments, 1);
        const self = this;
        const opts = args2opts(args, constructorInputs);
        opts.$abi = abi;
        opts.$byteCode = byteCode;

        checkWeb3(web3);
        const defer = Web3PromiEvent();

        const relayEvent = event => (..._args) => defer.eventEmitter.emit(event, ..._args);

        deploy(web3, opts, opts.$cb)
            // relay all events to our promiEvent
            .on("transactionHash", relayEvent("transactionHash"))
            .on("confirmation", relayEvent("confirmation"))
            .on("receipt", relayEvent("receipt"))
            .on("error", relayEvent("error"))
            .then(_contract => defer.resolve(new self(web3, _contract.options.address)))
            .catch(defer.reject);

        return defer.eventEmitter;
    };
    return C;
}

function checkWeb3(web3) {
    if (typeof web3.version !== "string" || !web3.version.startsWith("1.")) {
        throw new Error("web3 version 1.x is required");
    }
}
