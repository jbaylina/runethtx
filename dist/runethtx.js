"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

exports.default = {
    sendContractTx: sendContractTx,
    sendTx: sendTx,
    deploy: deploy,
    asyncfunc: asyncfunc
};


function deploy(web3, _ref, _cb) {
    var abi = _ref.abi,
        byteCode = _ref.byteCode,
        opts = _objectWithoutProperties(_ref, ["abi", "byteCode"]);

    return asyncfunc(function (cb) {
        var constructorAbi = abi.find(function (_ref2) {
            var type = _ref2.type;
            return type === "constructor";
        });
        var paramNames = void 0;
        var contract = void 0;
        var fromAccount = void 0;
        var gas = void 0;
        if (constructorAbi) {
            paramNames = constructorAbi.inputs.map(function (_ref3) {
                var name = _ref3.name;

                if (name[0] === "_") {
                    return name.substring(1);
                }
                return name;
            });
        } else {
            paramNames = [];
        }
        _async2.default.series([function (cb1) {
            if (opts.from) {
                fromAccount = opts.from;
                setTimeout(cb1, 1);
            } else {
                web3.eth.getAccounts(function (err, _accounts) {
                    if (err) {
                        console.log("xxxxx -> " + err);
                        cb1(err);
                        return;
                    }
                    if (_accounts.length === 0) {
                        cb1(new Error("No account to deploy a contract"));
                        return;
                    }
                    fromAccount = _accounts[0];
                    cb1();
                });
            }
        }, function (cb2) {
            var _web3$eth$contract$ne;

            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                value: opts.value || 0,
                data: byteCode,
                gas: 4000000
            });
            if (opts.verbose) {
                console.log("constructor: " + JSON.stringify(params));
            }
            var data = (_web3$eth$contract$ne = web3.eth.contract(abi).new).getData.apply(_web3$eth$contract$ne, _toConsumableArray(params));

            web3.eth.estimateGas({
                from: fromAccount,
                value: opts.value || 0,
                data: data,
                gas: 4000000
            }, function (err, _gas) {
                if (err) {
                    cb2(err);
                } else if (_gas >= 4000000) {
                    cb2(new Error("throw"));
                } else {
                    gas = _gas;
                    gas += opts.extraGas ? opts.extraGas : 10000;
                    cb2();
                }
            });
        }, function (cb3) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                value: opts.value || 0,
                data: byteCode,
                gas: opts.gas || gas
            });
            params.push(function (err, _contract) {
                if (err) {
                    cb3(err);
                    return;
                }
                if (typeof _contract.address !== "undefined") {
                    contract = _contract;
                    cb3();
                }
            });
            var ctr = web3.eth.contract(abi);
            ctr.new.apply(ctr, _toConsumableArray(params));
        }], function (err2) {
            if (err2) {
                cb(err2);
            } else {
                cb(null, contract);
            }
        });
    }, _cb);
}

function asyncfunc(f, cb) {
    var promise = new Promise(function (resolve, reject) {
        f(function (err, val) {
            if (err) {
                reject(err);
            } else {
                resolve(val);
            }
        });
    });
    if (cb) {
        promise.then(function (value) {
            cb(null, value);
        }, function (reason) {
            cb(reason);
        });
    } else {
        return promise;
    }
}

function sendTx(web3, _ref4, _cb) {
    var from = _ref4.from,
        value = _ref4.value,
        gas = _ref4.gas,
        gasPrice = _ref4.gasPrice,
        nonce = _ref4.nonce,
        to = _ref4.to,
        opts = _objectWithoutProperties(_ref4, ["from", "value", "gas", "gasPrice", "nonce", "to"]);

    return asyncfunc(function (cb) {
        var txOpts = {};
        var txHash = void 0;
        if (!to) {
            cb(new Error("to is required"));
            return;
        }
        txOpts.value = value || 0;
        if (gas) txOpts.gas = gas;
        if (gasPrice) txOpts.gasPrice = gasPrice;
        if (nonce) txOpts.nonce = nonce;
        _async2.default.series([function (cb1) {
            if (from) {
                txOpts.from = from;
                setTimeout(cb1, 1);
            } else {
                // eslint-disable-next-line no-underscore-dangle
                web3.eth.getAccounts(function (err, _accounts) {
                    if (err) {
                        console.log("xxxxx -> " + err);
                        cb1(err);
                        return;
                    }
                    if (_accounts.length === 0) {
                        cb1(new Error("No account to deploy a contract"));
                        return;
                    }
                    txOpts.from = _accounts[0];
                    cb1();
                });
            }
        }, function (cb1) {
            if (opts.verbose) {
                console.log("sendTx: " + JSON.stringify(txOpts));
            }
            txOpts.gas = 4000000;
            web3.eth.estimateGas(txOpts, function (err, _gas) {
                if (err) {
                    cb1(err);
                } else if (_gas >= 4000000) {
                    cb1(new Error("throw"));
                } else {
                    if (opts.gas) {
                        txOpts.gas = opts.gas;
                    } else {
                        txOpts.gas = _gas;
                        txOpts.gas += opts.extraGas ? opts.extraGas : 10000;
                    }
                    cb1();
                }
            });
        }, function (cb1) {
            web3.eth.sendTransaction(txOpts, function (err, _txHash) {
                if (err) {
                    cb1(err);
                } else {
                    txHash = _txHash;
                    cb1();
                }
            });
        }], function (err) {
            cb(err, txHash);
        });
    }, _cb);
}

function sendContractTx(web3, contract, method, opts, _cb) {
    return asyncfunc(function (cb) {
        if (!contract) {
            cb(new Error("Contract not defined"));
            return;
        }

        if (!method) {
            // TODO send raw transaction to the contract.
            cb(new Error("Method not defined"));
            return;
        }

        var errRes = void 0;

        var methodAbi = contract.abi.find(function (_ref5) {
            var name = _ref5.name,
                inputs = _ref5.inputs;

            if (name !== method) return false;
            var paramNames = inputs.map(function (param) {
                if (param.name[0] === "_") {
                    return param.name.substring(1);
                }
                return param.name;
            });
            for (var i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[paramNames[i]] === "undefined") {
                    errRes = new Error("Param " + paramNames[i] + " not found.");
                    return false;
                }
            }
            return true;
        });

        if (errRes) {
            cb(errRes);
            return;
        }

        if (!methodAbi) {
            cb(new Error("Invalid method"));
            return;
        }

        var paramNames = methodAbi.inputs.map(function (_ref6) {
            var name = _ref6.name;

            if (name[0] === "_") {
                return name.substring(1);
            }
            return name;
        });

        var fromAccount = void 0;
        var gas = void 0;
        var txHash = void 0;

        _async2.default.series([function (cb1) {
            if (opts.from) {
                fromAccount = opts.from;
                setTimeout(cb1, 1);
            } else {
                web3.eth.getAccounts(function (err, _accounts) {
                    if (err) {
                        console.log("xxxxx -> " + err);
                        cb1(err);
                        return;
                    }
                    if (_accounts.length === 0) {
                        cb1(new Error("No account to deploy a contract"));
                        return;
                    }
                    fromAccount = _accounts[0];
                    cb1();
                });
            }
        }, function (cb2) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            if (opts.verbose) console.log(method + ": " + JSON.stringify(params));
            params.push({
                from: fromAccount,
                value: opts.value,
                gas: 4000000
            });
            params.push(function (err, _gas) {
                if (err) {
                    cb2(err);
                } else if (_gas >= 4000000) {
                    cb2(new Error("throw"));
                } else {
                    gas = _gas;
                    gas += opts.extraGas ? opts.extraGas : 10000;
                    cb2();
                }
            });

            contract[method].estimateGas.apply(null, params);
        }, function (cb3) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                value: opts.value,
                gas: opts.gas || gas
            });
            params.push(function (err, _txHash) {
                if (err) {
                    cb3(err);
                } else {
                    txHash = _txHash;
                    cb3();
                }
            });

            contract[method].apply(null, params);
        }, function (cb4) {
            web3.eth.getTransactionReceipt(txHash, cb4);
        }], function (err) {
            cb(err, txHash);
        });
    }, _cb);
}
module.exports = exports["default"];
