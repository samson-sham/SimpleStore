const chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    { StoreSet, StoreMap } = require('../main'),
    Bluebird = require('bluebird'),
    path = require('path'),
    fs = require('fs');

chai.use(chaiAsPromised);

const 
    expect = chai.expect;
const
    TEST_DOMAIN = './test/';

let uid = 0;
function newFile() {
    uid++;
    return {
        DATA_SET_SOURCE: `./testSet${uid}.json`,
        DATA_MAP_SOURCE: `./testMap${uid}.json`
    }
}

describe('In memory', () => {
    let dataSet = new StoreSet(), 
        dataMap = new StoreMap();
    it('creates in-memory Set', () => {
        expect(dataSet).to.respondsTo('ready');
        return dataSet.ready().then(() => {
            expect(dataSet).to.have.own.property('data');
            expect(dataSet.data).to.be.an.instanceOf(Set);
        });
    });
    it('creates in-memory Map', () => {
        expect(dataMap).to.respondsTo('ready');
        return dataMap.ready().then(() => {
            expect(dataMap).to.have.own.property('data');
            expect(dataMap.data).to.be.an.instanceof(Map);
        });
    });
    it('adds to Set', () => {
        return dataSet.ready().then(() => {
            let addPromise = dataSet.add("key1");
            expect(addPromise).to.be.an.instanceof(Bluebird);  // [object Promise]
            // abusing the fact that this is in-memory storage
            expect(dataSet.length).to.equal(1);
            addPromise = addPromise.then(() => {
                dataSet.add("key2");
                return dataSet.add("key3");
            });
            // ERRORS happens here doesn't fail the test???
            expect(addPromise).to.eventually.equal(3);
            return addPromise;
        });
    });
    it('gets from Set', () => {
        return dataSet.ready().then(() => {
            expect(dataSet.has("key1")).to.be.true;
            expect(dataSet.has("key4")).to.be.false;
            expect(dataSet.get("key1")).to.be.undefined;
        });
    });
    it('adds to Map', () => {
        return dataMap.ready().then(() => {
            let addPromise = dataMap.add("key1", "value1");
            expect(addPromise).to.be.an.instanceof(Bluebird);  // [object Promise]
            // abusing the fact that this is in-memory storage
            expect(dataMap.length).to.equal(1);
            addPromise = addPromise.then(() => {
                dataMap.add("key2", "value2");
                return dataMap.add("key3", "value3");
            });
            // ERRORS happens here doesn't fail the test???
            expect(addPromise).to.eventually.equal(3);
            return addPromise;
        });
    });
    it('gets from Map', () => {
        return dataMap.ready().then(() => {
            expect(dataMap.has("key1")).to.be.true;
            expect(dataMap.has("key4")).to.be.false;
            expect(dataMap.get("key1")).to.equal("value1");
        });
    });
    it('clears from Set', () => {
        return dataSet.ready().then(() => {
            dataSet.clear();
            expect(dataSet.has("key1")).to.be.false;
            expect(dataSet.has("key2")).to.be.false;
            expect(dataSet.has("key3")).to.be.false;
        });
    });
    it('clears from Map', () => {
        return dataMap.ready().then(() => {
            dataMap.clear();
            expect(dataMap.has("key1")).to.be.false;
            expect(dataMap.has("key2")).to.be.false;
            expect(dataMap.has("key3")).to.be.false;
        });
    });
});
function mochaTestWaterfall(testFn) {
    return new Bluebird((resolve, reject) => {
        return resolve(testFn());
    });
}
describe('FileSystem I/O', () => {
    let {DATA_SET_SOURCE, DATA_MAP_SOURCE} = newFile();
    // This is to set a delay for throttled operation of data I/O
    // in order to perform the tests in a controlled manner where data are all settled
    // Instance of Data could be read when not setting delay
    let waterfallPromises = [new Promise((resolve, reject) => setTimeout(resolve, 1500))],
        _setSourcePath = path.resolve(process.cwd(), './test/', DATA_SET_SOURCE),
        _mapSourcePath = path.resolve(process.cwd(), './test/', DATA_MAP_SOURCE);
    before(() => {
        console.log("[mocha before]");
        try {
            fs.unlinkSync(_setSourcePath);
            fs.unlinkSync(_mapSourcePath);
        } catch(e) {}
    });
    after((() => {
        console.log("[mocha after]");
        setTimeout(() => {
            try {
                fs.unlinkSync(_setSourcePath);
                fs.unlinkSync(_mapSourcePath);
            } catch(e) {}
            console.log("[mocha after] clean up done");
        }, 2000);
    }));
    describe('Creation', () => {
        it('creates Set', () => {
            let r = new StoreSet({ dir: _setSourcePath });
            let promise = r.ready().then(() => {
                r.add("test1");
                r.add("test1");
                r.add("test2");
                return r.add("test3");
            }).then(() => {
                expect(fs.statSync(_setSourcePath).isFile()).to.be.true;
            });
            waterfallPromises.push(promise);
            return promise;
        });
        it('creates Map', () => {
            let r = new StoreMap({ dir: _mapSourcePath });
            let promise = r.ready().then(() => {
                r.add("key1", "value1");
                // r.add("key1", "value4");    // Overriding on purpose
                r.add("key2", "value2");
                return r.add("key3", "value3");
            }).then(() => {
                expect(fs.statSync(_mapSourcePath).isFile()).to.be.true;
            });
            waterfallPromises.push(promise);
            return promise;
        });
    });
    describe('Initialization', () => {
        it('initialize Set', () => {
            let promise = Bluebird.all(waterfallPromises).then(() => {
                let r = new StoreSet({ dir: _setSourcePath });
                return r.ready().then(() => {
                    expect(r.has("test1")).to.be.true;
                    expect(r.has("test2")).to.be.true;
                    expect(r.has("test3")).to.be.true;
                    expect(r.has("test4")).to.be.false;
                });
            });
            waterfallPromises.push(promise);
            return promise;
        });
        it('initialize Map', () => {
            let promise = Bluebird.all(waterfallPromises).then(() => {
                let r = new StoreMap({ dir: _mapSourcePath });
                return r.ready().then(() => {
                    expect(r.has("key1")).to.be.true;
                    expect(r.has("key2")).to.be.true;
                    expect(r.has("key3")).to.be.true;
                    expect(r.has("key4")).to.be.false;
                    expect(r.get("key1")).to.equal("value1");
                    expect(r.get("key2")).to.equal("value2");
                    expect(r.get("key3")).to.equal("value3");
                    expect(r.get("key4")).to.be.undefined;
                });
            });
            waterfallPromises.push(promise);
            return promise;
        });
    });
    describe('Overwrittable test', () => {
        describe('Creation without overwrittable', () => {
            it('creates Map with overwrittable error', () => {
                // @warning: this does not necessarily be executed after creation on above tests
                let r = new StoreMap({ dir: _mapSourcePath }),
                    promise = r.ready().then(() => {
                        r.add("key1", "value1");
                        expect(r.add("key1", "value4")).to.throw(new Error('[StoreSetAbstract add] data not overwrittable'));
                    });
                return expect(promise).to.eventually.rejected;
            });
        });
        describe('Creation with overwrittable', () => {
            it('creates Map with no error', () => {
                // @warning: this does not necessarily be executed after creation on above tests
                let r = new StoreMap({
                    dir: _mapSourcePath,
                    isOverwrittable: true
                }),
                promise = r.ready().then(() => {
                    r.add("key1", "value1");
                    r.add("key1", "value4");
                });
                return expect(promise).to.eventually.fulfilled;
            });
        });
    });
    describe('Test settle', () => {
        it('should wait for creation complete', () => {
            return Bluebird.all(waterfallPromises).then(() => {
                let r1 = new StoreSet({ dir: _setSourcePath });
                let r2 = new StoreMap({ dir: _mapSourcePath });
                return Bluebird.all([
                    r1.ready().then(() => {
                        r1.add("quickTest1");
                        r1.add("quickTest2");
                        r1.add("quickTest3");
                        return r1.settle().then(() => {
                            it('should have Set file', () => {
                                expect(fs.statSync(_setSourcePath).isFile()).to.be.true;
                            });
                            describe('Deletion test', () => {
                                r1.delete();
                                it('should not have Set file', () => {
                                    // Error: ENOENT: no such file or directory, stat '/Users/S/Desktop/Project/StoreSet/test/testSet.json'
                                    expect(fs.statSync.bind(this, _setSourcePath)).to.throw(/ENOENT/);
                                });
                            });
                        });
                    }),
                    r2.ready().then(() => {
                        r2.add("quickTest1", "value1");
                        r2.add("quickTest2", "value2");
                        r2.add("quickTest3", "value3");
                        return r2.settle().then(() => {
                            it('should have Set file', () => {
                                expect(fs.statSync(_mapSourcePath).isFile()).to.be.true;
                            });
                            describe('Deletion test', () => {
                                r2.delete();
                                it('should not have Map file', () => {
                                    // Error: ENOENT: no such file or directory, stat '/Users/S/Desktop/Project/StoreSet/test/testSet.json'
                                    expect(fs.statSync.bind(this, _mapSourcePath)).to.throw(/ENOENT/);
                                });
                            });
                        });
                    })
                ]);
            });
        });
    });
});
describe('Extensive deletion test', () => {
    let {DATA_SET_SOURCE, DATA_MAP_SOURCE} = newFile();
    let _setSourcePath = path.resolve(process.cwd(), './test/', DATA_SET_SOURCE),
        _mapSourcePath = path.resolve(process.cwd(), './test/', DATA_MAP_SOURCE);
    it('should interrupt the add process', () => {
        let r1 = new StoreSet({ dir: _setSourcePath });
        let r2 = new StoreMap({ dir: _mapSourcePath });
        Bluebird.all([
            r1.ready().then(() => {
                r1.add("quickTest1");
                r1.add("quickTest2");
                r1.add("quickTest3");
                r1.delete();
            }),
            r2.ready().then(() => {
                r2.add("quickTest1", "value1");
                r2.add("quickTest2", "value2");
                r2.add("quickTest3", "value3");
                r2.delete();
            })
        ]).then(() => {
            setTimeout(() => {
                it('should not have Set file', () => {
                    // Error: ENOENT: no such file or directory, stat '/Users/S/Desktop/Project/StoreSet/test/testSet.json'
                    expect(fs.statSync.bind(this, _setSourcePath)).to.throw(/ENOENT/);
                });
                it('should not have Map file', () => {
                    // Error: ENOENT: no such file or directory, stat '/Users/S/Desktop/Project/StoreSet/test/testSet.json'
                    expect(fs.statSync.bind(this, _mapSourcePath)).to.throw(/ENOENT/);
                });
            }, 100);
        });
    });
});
describe('Concatenate of add promises', () => {
    let {DATA_SET_SOURCE, DATA_MAP_SOURCE} = newFile();
    let _setSourcePath = path.resolve(process.cwd(), './test/', DATA_SET_SOURCE),
        _mapSourcePath = path.resolve(process.cwd(), './test/', DATA_MAP_SOURCE);
    let testSet = new StoreSet({ dir: _setSourcePath }),
        testMap = new StoreMap({ dir: _mapSourcePath });
    after((() => {
        console.log("[mocha after]");
        testSet.settle().then(() => {
            testSet.delete();
        });
        testMap.settle().then(() => {
            testMap.delete();
        });
        // setTimeout(() => {
        //     fs.unlinkSync(_setSourcePath);
        //     fs.unlinkSync(_mapSourcePath);
        //     console.log("[mocha after] clean up done");
        // }, 2000);
    }));
    it('concatenates add Set promises', () => {
        return testSet.ready().then(() => {
            return Promise.all([
                testSet.add("test4"),
                testSet.add("test5"),
                testSet.add("test6")
            ]);
        }).then(([result1, result2, result3]) => {
            it('has all promise resolved to the same value', () => {
                expect(result1).to.equal(result2);
                expect(result2).to.equal(result3);
            });
            it('has file saved after all promises resolved', () => {
                expect(fs.statSync(_setSourcePath).isFile()).to.be.true;
            });
        });
    });
    it('concatenates add Map promises', () => {
        return testMap.ready().then(() => {
            return Promise.all([
                testMap.add("test4", "value4"),
                testMap.add("test5", "value5"),
                testMap.add("test6", "value6")
            ]);
        }).then(([result1, result2, result3]) => {
            it('has all promise resolved to the same value', () => {
                expect(result1).to.equal(result2);
                expect(result2).to.equal(result3);
            });
            it('has file saved after all promises resolved', () => {
                expect(fs.statSync(_mapSourcePath).isFile()).to.be.true;
            });
        });
    });
});
describe('Relative path initialization', () => {
    let {DATA_SET_SOURCE, DATA_MAP_SOURCE} = newFile();
    let _setSourcePath = path.resolve(process.cwd(), DATA_SET_SOURCE),
        _mapSourcePath = path.resolve(process.cwd(), DATA_MAP_SOURCE);
    let testSet = new StoreSet({ dir: DATA_SET_SOURCE }),
        testMap = new StoreMap({ dir: DATA_MAP_SOURCE });
    after((() => {
        console.log("[mocha after]");
        testSet.settle().then(() => {
            testSet.delete();
        });
        testMap.settle().then(() => {
            testMap.delete();
        });
        // setTimeout(() => {
        //     fs.unlinkSync(_setSourcePath);
        //     fs.unlinkSync(_mapSourcePath);
        //     console.log("[mocha after] clean up done");
        // }, 2000);
    }));
    it('creates Set', () => {
        return testSet.ready().then(() => {
            return testSet.add("test1");  // Assuming add promise works
        }).then(() => {
            expect(fs.statSync(_setSourcePath).isFile()).to.be.true;
        });
    });
    it('creates Map', () => {
        return testMap.ready().then(() => {
            return testMap.add("test1", "value1");  // Assuming add promise works
        }).then(() => {
            expect(fs.statSync(_mapSourcePath).isFile()).to.be.true;
        });
    });
});