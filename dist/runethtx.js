"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

exports.default = {
    send: send,
    deploy: deploy
};


function deploy(web3, _ref, cb) {
    var abi = _ref.abi,
        byteCode = _ref.byteCode,
        opts = _objectWithoutProperties(_ref, ["abi", "byteCode"]);

    var promise = new Promise(function (resolve, reject) {
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
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            if (opts.verbose) console.log("constructor: " + JSON.stringify(params));
            params.push({
                from: fromAccount,
                value: opts.value || 0,
                data: byteCode,
                gas: 4000000
            });
            var data = web3.eth.contract(abi).new.getData.apply(null, params);

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
                gas: gas
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
            ctr.new.apply(ctr, params);
        }], function (err2) {
            if (err2) {
                reject(err2);
            } else {
                resolve(contract);
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

function send(_ref4, cb) {
    var contract = _ref4.contract,
        method = _ref4.method,
        opts = _objectWithoutProperties(_ref4, ["contract", "method"]);

    var promise = new Promise(function (resolve, reject) {
        if (!contract) {
            reject(new Error("Contract not defined"));
            return;
        }

        if (!method) {
            // TODO send raw transaction to the contract.
            reject(new Error("Method not defined"));
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
            reject(errRes);
            return;
        }

        if (!methodAbi) {
            reject(new Error("Invalid method"));
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
                // eslint-disable-next-line no-underscore-dangle
                contract._eth.getAccounts(function (err, _accounts) {
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
                gas: gas
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
            // eslint-disable-next-line no-underscore-dangle
            contract._eth.getTransactionReceipt(txHash, cb4);
        }], function (err2) {
            if (err2) {
                reject(err2);
            } else {
                resolve(txHash);
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
module.exports = exports["default"];
