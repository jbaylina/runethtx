import async from "async";

export default {
    send,
    deploy,
};

function deploy(web3, { abi, byteCode, ...opts }, cb) {
    const promise = new Promise((resolve, reject) => {
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
                if (opts.verbose) console.log("constructor: " + JSON.stringify(params));
                params.push({
                    from: fromAccount,
                    value: opts.value || 0,
                    data: byteCode,
                    gas: 4000000,
                });
                const data = web3.eth.contract(abi).new.getData.apply(null, params);

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
                    gas,
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
                ctr.new.apply(ctr, params);
            },
        ], (err2) => {
            if (err2) {
                reject(err2);
            } else {
                resolve(contract);
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

function send({ contract, method, ...opts }, cb) {
    const promise = new Promise((resolve, reject) => {
        if (!contract) {
            reject(new Error("Contract not defined"));
            return;
        }

        if (!method) {
            // TODO send raw transaction to the contract.
            reject(new Error("Method not defined"));
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
            reject(errRes);
            return;
        }

        if (!methodAbi) {
            reject(new Error("Invalid method"));
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
                    // eslint-disable-next-line no-underscore-dangle
                    contract._eth.getAccounts((err, _accounts) => {
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
                    gas,
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
                // eslint-disable-next-line no-underscore-dangle
                contract._eth.getTransactionReceipt(txHash, cb4);
            },
        ], (err2) => {
            if (err2) {
                reject(err2);
            } else {
                resolve(txHash);
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
