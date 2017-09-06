"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var Web3PromiEvent = require("web3-core-promievent");
var utils = require("web3-utils");

utils.fireError = utils._fireError; // eslint-disable-line no-underscore-dangle

module.exports = {
    sendContractTx: sendContractTx,
    sendTx: sendTx,
    getBalance: getBalance,
    getTransactionReceipt: getTransactionReceipt,
    getBlock: getBlock,
    deploy: deploy,
    asyncfunc: asyncfunc,
    generateClass: generateClass
};

var getParamNames = function getParamNames(inputs) {
    return inputs.map(function (param) {
        if (param.name[0] === "_") {
            return param.name.substring(1);
        }
        return param.name;
    });
};

var estimateGas = function estimateGas(web3, method, opts) {
    if (opts.$noEstimateGas) return Promise.resolve(4700000);
    if (opts.$gas) return Promise.resolve(opts.$gas);

    return method.estimateGas({
        value: opts.$value || 0,
        gas: 4700000,
        from: opts.$from
    }).then(function (_gas) {
        if (_gas >= 4700000) throw new Error("gas limit reached: " + _gas);

        if (opts.$verbose) console.log("Gas: " + _gas); // eslint-disable-line no-console

        return opts.$extraGas ? _gas + opts.$extraGas : _gas + 10000;
    });
};

var getAccount = function getAccount(web3, opts) {
    if (opts.$from) {
        return Promise.resolve(opts.$from);
    }
    return web3.eth.getAccounts().then(function (_accounts) {
        if (_accounts.length === 0) throw new Error("No account available");

        return _accounts[0];
    }).catch(function (err) {
        console.log("xxxxx -> " + err); // eslint-disable-line no-console
        throw err;
    });
};

function sendMethodTx(web3, defer, method, opts) {
    var relayEvent = function relayEvent(event) {
        return function () {
            var _defer$eventEmitter;

            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            return (_defer$eventEmitter = defer.eventEmitter).emit.apply(_defer$eventEmitter, [event].concat(args));
        };
    };

    var txParams = {
        value: opts.$value || 0
    };

    if (opts.$gasPrice) txParams.gasPrice = opts.$gasPrice;

    getAccount(web3, opts).then(function (account) {
        txParams.from = account;
        return estimateGas(web3, method, Object.assign({}, opts, { $from: account }));
    }).catch(function (err) {
        // make sure 'error' event is emitted
        utils.fireError(err, defer.eventEmitter, defer.reject);
        throw err;
    }).then(function (gas) {
        return method.send(_extends({
            gas: gas
        }, txParams))
        // relay all events to our promiEvent
        .on("transactionHash", relayEvent("transactionHash")).on("confirmation", relayEvent("confirmation")).on("receipt", relayEvent("receipt")).on("error", relayEvent("error"));
    }).then(defer.resolve).catch(defer.reject);
}

function deploy(web3, _ref, _cb) {
    var $abi = _ref.$abi,
        $byteCode = _ref.$byteCode,
        opts = _objectWithoutProperties(_ref, ["$abi", "$byteCode"]);

    return asyncfunc(function () {
        var defer = Web3PromiEvent();

        var fireError = function fireError(err) {
            return utils.fireError(err, defer.eventEmitter, defer.reject);
        };

        try {
            checkWeb3(web3);
        } catch (e) {
            return fireError(e);
        }

        var constructorAbi = $abi.find(function (_ref2) {
            var type = _ref2.type;
            return type === "constructor";
        });

        var paramNames = constructorAbi ? getParamNames(constructorAbi.inputs) : [];
        var params = paramNames.map(function (name) {
            return opts[name];
        });

        if (opts.$verbose) console.log("constructor: " + JSON.stringify(params)); // eslint-disable-line no-console

        var ctr = new web3.eth.Contract($abi).deploy({
            data: $byteCode,
            arguments: params
        });

        sendMethodTx(web3, defer, ctr, opts);

        return defer.eventEmitter;
    }, _cb);
}

function asyncfunc(f, cb) {
    var promise = f();

    if (cb) {
        if (promise.on) {
            // this is a send tx.
            promise.on("transactionHash", function (_txHash) {
                return cb(null, _txHash);
            }).then(function (_txReceipt) {
                return cb(null, null, _txReceipt);
            }).catch(cb);
        } else {
            // this is a call tx. we want to return the result
            promise.then(function (value) {
                return cb(null, value);
            }, cb);
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

function sendTx(web3, _ref3, _cb) {
    var data = _ref3.data,
        from = _ref3.from,
        value = _ref3.value,
        gasPrice = _ref3.gasPrice,
        nonce = _ref3.nonce,
        to = _ref3.to,
        opts = _objectWithoutProperties(_ref3, ["data", "from", "value", "gasPrice", "nonce", "to"]);

    return asyncfunc(function () {
        var defer = Web3PromiEvent();

        var fireError = function fireError(err) {
            return utils.fireError(err, defer.eventEmitter, defer.reject);
        };

        var relayEvent = function relayEvent(event) {
            return function () {
                var _defer$eventEmitter2;

                for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                    args[_key2] = arguments[_key2];
                }

                return (_defer$eventEmitter2 = defer.eventEmitter).emit.apply(_defer$eventEmitter2, [event].concat(args));
            };
        };

        try {
            checkWeb3(web3);
        } catch (e) {
            return fireError(e);
        }

        var txOpts = {};

        if (!to) return fireError(new Error("to is required"));

        txOpts.to = to;
        txOpts.value = value || 0;
        if (gasPrice) txOpts.gasPrice = gasPrice;
        if (nonce) txOpts.nonce = nonce;
        if (data) txOpts.data = data;

        var _estimateGas = function _estimateGas() {
            // eslint-disable-line no-underscore-dangle
            if (opts.$noEstimateGas) return Promise.resolve(4700000);
            if (opts.gas) return Promise.resolve(opts.gas);

            return web3.eth.estimateGas(txOpts).then(function (gas) {
                if (gas >= 4700000) throw new Error("gas limit reached: " + gas);

                if (opts.$verbose) console.log("Gas: " + gas); // eslint-disable-line no-console

                return opts.$extraGas ? gas + opts.$extraGas : gas + 10000;
            });
        };

        getAccount(web3, { $from: from }).then(function (account) {
            txOpts.from = account;
            return _estimateGas();
        }).catch(function (err) {
            fireError(err); // make sure 'error' event is emitted
            throw err;
        }).then(function (gas) {
            txOpts.gas = gas;

            if (opts.$verbose) console.log("sendTx: " + JSON.stringify(txOpts)); // eslint-disable-line no-console

            return web3.eth.sendTransaction(_extends({}, txOpts))
            // relay all events to our promiEvent
            .on("transactionHash", relayEvent("transactionHash")).on("confirmation", relayEvent("confirmation")).on("receipt", relayEvent("receipt")).on("error", relayEvent("error"));
        }).then(defer.resolve).catch(defer.reject);

        return defer.eventEmitter;
    }, _cb);
}

function sendContractConstTx(web3, contract, method, opts, _cb) {
    return asyncfunc(function () {
        try {
            checkWeb3(web3);
        } catch (e) {
            return Promise.reject(e);
        }

        if (!contract) return Promise.reject(new Error("Contract not defined"));

        // TODO send raw transaction to the contract.
        if (!method) return Promise.reject(new Error("Method not defined"));

        var errRes = void 0;

        var methodAbi = contract.options.jsonInterface.find(function (_ref4) {
            var name = _ref4.name,
                inputs = _ref4.inputs;

            if (name !== method) return false;

            var paramNames = getParamNames(inputs);

            for (var i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[paramNames[i]] === "undefined") {
                    errRes = new Error("Param " + paramNames[i] + " not found.");
                    return false;
                }
            }
            return true;
        });

        if (errRes) return Promise.reject(new Error(errRes));

        if (!methodAbi) return Promise.reject(new Error("Invalid method"));

        var params = getParamNames(methodAbi.inputs).map(function (name) {
            return opts[name];
        });

        try {
            return contract.methods[method].apply(null, params).call();
        } catch (e) {
            return Promise.reject(e);
        }
    }, _cb);
}

function sendContractTx(web3, contract, method, opts, _cb) {
    return asyncfunc(function () {
        var defer = Web3PromiEvent();

        // catch is to prevent unhandled exception
        var fireError = function fireError(err) {
            return utils.fireError(err, defer.eventEmitter, defer.reject);
        };

        try {
            checkWeb3(web3);
        } catch (e) {
            return fireError(e);
        }

        if (!contract) return fireError(new Error("Contract not defined"));

        // TODO send raw transaction to the contract.
        if (!method) return fireError(new Error("Method not defined"));

        var errRes = void 0;

        var methodAbi = contract.options.jsonInterface.find(function (_ref5) {
            var name = _ref5.name,
                inputs = _ref5.inputs;

            if (name !== method) return false;
            var paramNames = getParamNames(inputs);
            for (var i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[paramNames[i]] === "undefined") {
                    errRes = new Error("Param " + paramNames[i] + " not found.");
                    return false;
                }
            }
            return true;
        });

        if (errRes) return fireError(errRes);

        if (!methodAbi) return fireError(new Error("Invalid method"));

        var params = getParamNames(methodAbi.inputs).map(function (name) {
            return opts[name];
        });

        if (opts.$verbose) console.log(method + ": " + JSON.stringify(params)); // eslint-disable-line no-console

        var m = contract.methods[method].apply(null, params);

        sendMethodTx(web3, defer, m, opts);

        return defer.eventEmitter;
    }, _cb);
}

function sendAction(web3, action, contract, method, opts, _cb) {
    return asyncfunc(function (cb) {
        if (action.type === "ACCOUNT") {
            var data = getData(contract, method, opts);
        } else if (action.type === "MULTISIG_START") {} else if (action.type === "MULTISIG_CONFIRM") {} else if (action.type === "MULTISIG_REVOKE") {}
    }, cb);
}

function args2opts(_args, inputs) {
    var norm = function norm(S) {
        return S[0] == "_" ? S.substring(1) : S;
    };
    var isObject = function isObject(o) {
        return (typeof o === "undefined" ? "undefined" : _typeof(o)) === "object" && Object.keys(o).sort().join("") != "ces" && !(o instanceof Array);
    };
    var args = _args.slice();
    var opts = {};
    if (typeof args[args.length - 1] === "function") {
        opts.$cb = args.pop();
    }

    for (var i = 0; args.length > 0 && !isObject(args[0]) && i < inputs.length; i++) {
        opts[norm(inputs[i].name)] = args.shift();
    }
    while (args.length > 0) {
        var o = args.shift();
        if (!isObject(o)) return null;
        var isOld = false;
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
    var constructorInputs = [];
    var C = function C(web3, address) {
        checkWeb3(web3);
        this.$web3 = web3;
        this.$address = address;
        this.$contract = new this.$web3.eth.Contract(abi, address);
        this.$abi = abi;
        this.$byteCode = byteCode;
    };
    abi.forEach(function (_ref6) {
        var constant = _ref6.constant,
            name = _ref6.name,
            inputs = _ref6.inputs,
            type = _ref6.type;

        // TODO overloaded functions
        if (type === "function") {
            var c = function c() {
                var args = Array.prototype.slice.call(arguments);
                var self = this;
                var opts = args2opts(args, inputs);

                return sendContractConstTx(self.$web3, self.$contract, name, opts, opts.$cb);
            };
            if (!constant) {
                C.prototype[name] = function () {
                    var args = Array.prototype.slice.call(arguments);
                    var self = this;
                    var opts = args2opts(args, inputs);

                    return sendContractTx(self.$web3, self.$contract, name, opts, opts.$cb);
                };
            } else {
                C.prototype[name] = c;
            }
            C.prototype[name].call = c;
        } else if (type === "constructor") {
            constructorInputs = inputs;
        }
    });
    C.new = function (web3) {
        var args = Array.prototype.slice.call(arguments, 1);
        var self = this;
        var opts = args2opts(args, constructorInputs);
        opts.$abi = abi;
        opts.$byteCode = byteCode;

        checkWeb3(web3);
        var defer = Web3PromiEvent();

        var relayEvent = function relayEvent(event) {
            return function () {
                var _defer$eventEmitter3;

                for (var _len3 = arguments.length, _args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
                    _args[_key3] = arguments[_key3];
                }

                return (_defer$eventEmitter3 = defer.eventEmitter).emit.apply(_defer$eventEmitter3, [event].concat(_args));
            };
        };

        deploy(web3, opts, opts.$cb)
        // relay all events to our promiEvent
        .on("transactionHash", relayEvent("transactionHash")).on("confirmation", relayEvent("confirmation")).on("receipt", relayEvent("receipt")).on("error", relayEvent("error")).then(function (_contract) {
            return defer.resolve(new self(web3, _contract.options.address));
        }).catch(defer.reject);

        return defer.eventEmitter;
    };
    return C;
}

function checkWeb3(web3) {
    if (typeof web3.version !== "string" || !web3.version.startsWith("1.")) {
        throw new Error("web3 version 1.x is required");
    }
}