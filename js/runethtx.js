import async from "async";

export default runEthTx;

function runEthTx({ contract, method, ...opts }, cb) {
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

        const methodAbi = contract.abi.find(({ name, inputs }) => {
            if (name !== method) return false;
            const paramNames = inputs.map((param) => {
                if (param.name[ 0 ] === "_") {
                    return param.name.substring(1);
                }
                return param.name;
            });
            for (let i = 0; i < paramNames.length; i += 1) {
                if (typeof opts[ paramNames[ i ] ] === "undefined") return false;
            }
            return true;
        });

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
                params.push({
                    from: fromAccount,
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
//                console.log(method + ": " + JSON.stringify(params));
                params.push({
                    from: fromAccount,
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
        ], (err) => {
            if (err) {
                reject(err);
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
