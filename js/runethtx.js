const async = require("async");

module.exports = {
    sendContractTx,
    sendTx,
    getBalance,
    getTransactionReceipt,
    getBlock,
    deploy,
    asyncfunc,
    generateClass
};

function deploy(web3, { $abi, $byteCode, ...opts }, _cb) {
    return asyncfunc((cb) => {
        const constructorAbi = $abi.find(({ type }) => (type === "constructor"));
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
                if (opts.$from) {
                    fromAccount = opts.$from;
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
                if (opts.$gas) {
                    gas = opts.$gas;
                    cb2();
                    return;
                }
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    value: opts.$value || 0,
                    data: $byteCode,
                    gas: 4000000,
                });
                if (opts.$verbose) {
                    console.log("constructor: " + JSON.stringify(params));
                }
                const data = web3.eth.contract($abi).new.getData(...params);

                web3.eth.estimateGas({
                    from: fromAccount,
                    value: opts.$value || 0,
                    data,
                    gas: 4000000,
                }, (err, _gas) => {
                    if (err) {
                        cb2(err);
                    } else if (_gas >= 4000000) {
                        cb2(new Error("throw"));
                    } else {
                        if (opts.$verbose) {
                            console.log("Gas: " + _gas);
                        }
                        gas = _gas;
                        gas += opts.$extraGas ? opts.$extraGas : 10000;
                        cb2();
                    }
                });
            },
            (cb3) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    value: opts.$value || 0,
                    data: $byteCode,
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
                const ctr = web3.eth.contract($abi);
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

function getBalance(web3, address, _cb) {
    return asyncfunc((cb) => {
        web3.eth.getBalance(address, cb);
    }, _cb);
}

function getTransactionReceipt(web3, txHash, _cb) {
    return asyncfunc((cb) => {
        web3.eth.getTransactionReceipt(txHash, cb);
    }, _cb);
}

function getBlock(web3, blockNumber, _cb) {
    return asyncfunc((cb) => {
        web3.eth.getBlock(blockNumber, cb);
    }, _cb);
}

function sendTx(web3, { data, from, value, gas, gasPrice, nonce, to, ...opts }, _cb) {
    return asyncfunc((cb) => {
        const txOpts = {};
        let txHash;
        if (!to) {
            cb(new Error("to is required"));
            return;
        }
        txOpts.to = to;
        txOpts.value = value || 0;
        if (gas) txOpts.gas = gas;
        if (gasPrice) txOpts.gasPrice = gasPrice;
        if (nonce) txOpts.nonce = nonce;
        if (data) txOpts.data = data;
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
                if (opts.$gas) {
                    txOpts.gas = opts.$gas;
                    cb1();
                    return;
                }
                if (opts.$verbose) {
                    console.log("sendTx: " + JSON.stringify(txOpts));
                }
                txOpts.$gas = 4000000;
                web3.eth.estimateGas(txOpts, (err, _gas) => {
                    if (err) {
                        cb1(err);
                    } else if (_gas >= 4000000) {
                        cb1(new Error("throw"));
                    } else {
                        if (opts.$verbose) {
                            console.log("Gas: " + _gas);
                        }
                        if (opts.$gas) {
                            txOpts.gas = opts.$gas;
                        } else {
                            txOpts.gas = _gas;
                            txOpts.gas += opts.$extraGas ? opts.$extraGas : 10000;
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
            (cb1) => {
                setTimeout(cb1, 100);
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
                if (opts.$from) {
                    fromAccount = opts.$from;
                    setTimeout(cb1, 1);
                } else {
                    web3.eth.getAccounts((err, _accounts) => {
                        if (err) {
                            console.log("xxxxx -> " + err);
                            cb1(err);
                            return;
                        }
                        if (_accounts.length === 0) {
                            cb1(new Error("No account to send the TX"));
                            return;
                        }
                        fromAccount = _accounts[ 0 ];
                        cb1();
                    });
                }
            },
            (cb2) => {
                if (opts.$noEstimateGas) {
                    gas = 4000000;
                    cb2();
                    return;
                }
                if (opts.$gas) {
                    gas = opts.$gas;
                    cb2();
                    return;
                }
                const params = paramNames.map(name => opts[ name ]);
                if (opts.$verbose) console.log(method + ": " + JSON.stringify(params));
                params.push({
                    from: fromAccount,
                    value: opts.$value,
                    gas: 4000000,
                });
                params.push((err, _gas) => {
                    if (err) {
                        cb2(err);
                    } else if (_gas >= 4000000) {
                        cb2(new Error("throw"));
                    } else {
                        if (opts.$verbose) {
                            console.log("Gas: " + _gas);
                        }
                        gas = _gas;
                        gas += opts.$extraGas ? opts.$extraGas : 10000;
                        cb2();
                    }
                });

                contract[ method ].estimateGas.apply(null, params);
            },
            (cb3) => {
                const params = paramNames.map(name => opts[ name ]);
                params.push({
                    from: fromAccount,
                    value: opts.$value,
                    gas: opts.$gas || gas,
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

function sendContractConstTx(web3, contract, method, opts, _cb) {
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

        const params = paramNames.map(name => opts[ name ]);
        params.push(cb);

        contract[ method ].apply(null, params);
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
    const norm = (S) => {
        return S[0] == '_' ? S.substring(1) : S;
    }
    const isObject = (o) => {
        return ((typeof o == "object") && (Object.keys(o).sort().join('') != 'ces') && !(o instanceof Array));
    }
    let args = _args.slice();
    let opts = {};
    if (typeof args[args.length -1 ] === "function") {
        opts.$cb = args.pop();
    }

    for (let i=0; args.length > 0 && !isObject(args[0]) && i<inputs.length; i++) {
        opts[norm(inputs[i].name)] = args.shift();
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
            this.$web3 = web3;
            this.$address = address;
            this.$contract = this.$web3.eth.contract(abi).at(address);
            this.$abi = abi;
            this.$byteCode = byteCode;
    }
    abi.forEach(({ constant, name, inputs, type }) => {
        // TODO overloaded functions
        if (type === "function") {
            const c = function() {
                const args = Array.prototype.slice.call(arguments);
                const self = this;
                var opts = args2opts(args, inputs);
                return asyncfunc( (cb) => {
                    return sendContractConstTx(
                            self.$web3,
                            self.$contract,
                            name,
                            opts,
                            cb);
                }, opts.$cb);
            }
            if (!constant) {
                C.prototype[name] = function() {
                    const args = Array.prototype.slice.call(arguments);
                    const self = this;
                    var opts = args2opts(args, inputs);
                    return asyncfunc( (cb) => {
                        return sendContractTx(
                                self.$web3,
                                self.$contract,
                                name,
                                opts,
                                cb);
                    }, opts.$cb);
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
        const args = Array.prototype.slice.call(arguments, 1);
        const self = this;
        let nargs;
        let cb;
        var opts = args2opts(args, constructorInputs);
        opts.$abi = abi;
        opts.$byteCode = byteCode;
        return asyncfunc( (cb) => {
            return deploy(web3, opts, (err, _contract) => {
                if (err) {
                    cb(err);
                    return;
                }
                const cls = new C(web3, _contract.address);
                cb(null, cls);
            });
        }, opts.$cb);

    };
    return C;
}

