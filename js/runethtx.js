import async from "async";

export default {
    sendContractTx,
    sendTx,
    deploy,
    asyncfunc,
};

function deploy(web3, { abi, byteCode, ...opts }, _cb) {
    return asyncfunc((cb) => {
        const constructorAbi = abi.find(({ type }) => (type === "constructor"));
        let paramNames;
        let contract;
        let fromAccount;
        let gas;
        if (constructorAbi) {
            paramNames = constructorAbi.inputs.map(({ name }) => {
                if (name[ 0 ] === "_") {
                    return name.substring(1);
                }
                return name;
            });
        } else {
            paramNames = [];
        }
        async.series([
            (cb1) => {
                if (opts.from) {
                    fromAccount = opts.from;
                    setTimeout(cb1, 1);
                } else {
                    web3.eth.getAccounts((err, _accounts) => {
                        if (err) {
                            console.log("xxxxx -> " + err);
                            cb1(err);
                            return;
                        }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to deploy a contract"));
                            return;
                        }
                        fromAccount = _accounts[ 0 ];
                        cb1();
                    });
                }
            },
            (cb2) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    value: opts.value || 0,
                    data: byteCode,
                    gas: 4000000,
                });
                if (opts.verbose) {
                    console.log("constructor: " + JSON.stringify(params));
                }
                const data = web3.eth.contract(abi).new.getData(...params);

                web3.eth.estimateGas({
                    from: fromAccount,
                    value: opts.value || 0,
                    data,
                    gas: 4000000,
                }, (err, _gas) => {
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
            },
            (cb3) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    value: opts.value || 0,
                    data: byteCode,
                    gas: opts.gas || gas,
                });
                params.push((err, _contract) => {
                    if (err) {
                        cb3(err);
                        return;
                    }
                    if (typeof _contract.address !== "undefined") {
                        contract = _contract;
                        cb3();
                    }
                });
                const ctr = web3.eth.contract(abi);
                ctr.new(...params);
            },
        ], (err2) => {
            if (err2) {
                cb(err2);
            } else {
                cb(null, contract);
            }
        });
    }, _cb);
}

function asyncfunc(f, cb) {
    const promise = new Promise((resolve, reject) => {
        f((err, val) => {
            if (err) {
                reject(err);
            } else {
                resolve(val);
            }
        });
    });
    if (cb) {
        promise.then(
            (value) => {
                cb(null, value);
            },
            (reason) => {
                cb(reason);
            });
    } else {
        return promise;
    }
}

function sendTx(web3, { from, value, gas, gasPrice, nonce, to, ...opts }, _cb) {
    return asyncfunc((cb) => {
        const txOpts = {};
        let txHash;
        if (!to) {
            cb(new Error("to is required"));
            return;
        }
        txOpts.value = value || 0;
        if (gas) txOpts.gas = gas;
        if (gasPrice) txOpts.gasPrice = gasPrice;
        if (nonce) txOpts.nonce = nonce;
        async.series([
            (cb1) => {
                if (from) {
                    txOpts.from = from;
                    setTimeout(cb1, 1);
                } else {
                    // eslint-disable-next-line no-underscore-dangle
                    web3.eth.getAccounts((err, _accounts) => {
                        if (err) {
                            console.log("xxxxx -> " + err);
                            cb1(err);
                            return;
                        }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to deploy a contract"));
                            return;
                        }
                        txOpts.from = _accounts[ 0 ];
                        cb1();
                    });
                }
            },
            (cb1) => {
                if (opts.verbose) {
                    console.log("sendTx: " + JSON.stringify(txOpts));
                }
                txOpts.gas = 4000000;
                web3.eth.estimateGas(txOpts, (err, _gas) => {
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
            },
            (cb1) => {
                web3.eth.sendTransaction(txOpts, (err, _txHash) => {
                    if (err) {
                        cb1(err);
                    } else {
                        txHash = _txHash;
                        cb1();
                    }
                });
            },
        ], (err) => {
            cb(err, txHash);
        });
    }, _cb);
}

function sendContractTx(web3, contract, method, opts, _cb) {
    return asyncfunc((cb) => {
        if (!contract) {
            cb(new Error("Contract not defined"));
            return;
        }

        if (!method) {
            // TODO send raw transaction to the contract.
            cb(new Error("Method not defined"));
            return;
        }

        let errRes;

        const methodAbi = contract.abi.find(({ name, inputs }) => {
            if (name !== method) return false;
            const paramNames = inputs.map((param) => {
                if (param.name[ 0 ] === "_") {
                    return param.name.substring(1);
                }
                return param.name;
            });
            for (let i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[ paramNames[ i ] ] === "undefined") {
                    errRes = new Error("Param " + paramNames[ i ] + " not found.");
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

        const paramNames = methodAbi.inputs.map(({ name }) => {
            if (name[ 0 ] === "_") {
                return name.substring(1);
            }
            return name;
        });

        let fromAccount;
        let gas;
        let txHash;

        async.series([
            (cb1) => {
                if (opts.from) {
                    fromAccount = opts.from;
                    setTimeout(cb1, 1);
                } else {
                    web3.eth.getAccounts((err, _accounts) => {
                        if (err) {
                            console.log("xxxxx -> " + err);
                            cb1(err);
                            return;
                        }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to deploy a contract"));
                            return;
                        }
                        fromAccount = _accounts[ 0 ];
                        cb1();
                    });
                }
            },
            (cb2) => {
                const params = paramNames.map(name => opts[ name ]);
                if (opts.verbose) console.log(method + ": " + JSON.stringify(params));
                params.push({
                    from: fromAccount,
                    value: opts.value,
                    gas: 4000000,
                });
                params.push((err, _gas) => {
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

                contract[ method ].estimateGas.apply(null, params);
            },
            (cb3) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    value: opts.value,
                    gas: opts.gas || gas,
                });
                params.push((err, _txHash) => {
                    if (err) {
                        cb3(err);
                    } else {
                        txHash = _txHash;
                        cb3();
                    }
                });

                contract[ method ].apply(null, params);
            },
            (cb4) => {
                web3.eth.getTransactionReceipt(txHash, cb4);
            },
        ], (err) => {
            cb(err, txHash);
        });
    }, _cb);
}
