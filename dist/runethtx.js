"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = runEthTx;

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function runEthTx(_ref, cb) {
    var contract = _ref.contract,
        method = _ref.method,
        opts = _objectWithoutProperties(_ref, ["contract", "method"]);

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

        var methodAbi = contract.abi.find(function (_ref2) {
            var name = _ref2.name;
            return name === method;
        });

        if (!methodAbi) {
            reject(new Error("Invalid method"));
            return;
        }

        var paramNames = methodAbi.inputs.map(function (_ref3) {
            var name = _ref3.name;

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
                setImmediate(cb1);
            } else {
                // eslint-disable-next-line no-underscore-dangle
                contract._eth.getAccounts(function (err, _accounts) {
                    if (err) {
                        cb1(err);return;
                    }
                    if (_accounts.length === 0) {
                        cb1(new Error("No account to deploy a contract"));
                        return;
                    }
                    fromAccount = _accounts[0];
                    cb1();
                });
            }
        }, function (cb1) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                gas: 4000000
            });
            params.push(function (err, _gas) {
                if (err) {
                    cb1(err);
                } else if (_gas >= 4000000) {
                    cb1(new Error("throw"));
                } else {
                    gas = _gas;
                    gas += opts.extraGas ? opts.extraGas : 10000;
                    cb1();
                }
            });

            contract[method].estimateGas.apply(null, params);
        }, function (cb1) {
            var params = paramNames.map(function (name) {
                return opts[name];
            });
            params.push({
                from: fromAccount,
                gas: gas
            });
            params.push(function (err, _txHash) {
                if (err) {
                    cb1(err);
                } else {
                    txHash = _txHash;
                    cb1();
                }
            });

            contract[method].apply(null, params);
        }], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(txHash);
            }
        });
    });

    if (cb) {
        promise.then(function (value) {
            cb(null, value);
        }, function (reason) {
            cb(null, reason);
        });
    } else {
        return promise;
    }
}
module.exports = exports["default"];
