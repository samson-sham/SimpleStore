const 
    path = require('path'),
    fs = require('fs-extra'),
    Bluebird = require('bluebird'),
    readPromise = Bluebird.promisify(fs.readFile);
const
    MB = 1000 * 1000,
    DATASET = './dataset.json',
    THROTTLE_INTERVAL = 500;
let _ = {};
_.throttle = require('lodash.throttle');
class StoreAbstract {
    // dir = DATASET, pageSizeMB
    constructor(opts = {}) {
        let _options = {};
        Object.assign(_options, {
            // 'dir': DATASET,
            'pageSizeMB': 5,
            'isOverwrittable': false
        }, opts);
        this._isOverwrittable = _options.isOverwrittable;
        this._dir = _options.dir && 
            (path.isAbsolute(_options.dir) ? 
                _options.dir
                : path.resolve(process.cwd(), _options.dir));
        console.log('[StoreAbstract construct]', this._dir, opts, _options);
        // // @TODO: check _.throttle() return will have affects or not
        // this.saveState = _.throttle(() => {
            
        //     this.__saveState();
        // }, THROTTLE_INTERVAL);
        this.init(_options.pageSizeMB);
    }
    ready(fn = () => {}) {
        return this.initPromise.then(fn);
    }
    __init() {
        // to be override
        throw new Error('[StoreAbstract] __init not override');
        return this;
    }
    __initFromJson(content) {
        // to be override
        throw new Error('[StoreAbstract] __initFromJson not override');
        return this;
    }
    init(pageSizeMB) {
        if (!this._dir) {
            // In memory
            this.initPromise = Bluebird.resolve(this.__init());
        } else {
            // Find existing cache
            this.initPromise = new Bluebird((resolve, reject) => {
                // Check file size if it is larger than pageSize
                let filesize = fs.statSync(this._dir).size;
                if (filesize > pageSizeMB * MB) {
                    // Save as backup
                    console.log(`\x1b[91m[StoreAbstract] WARNING!! Filesize ${filesize} exceeds pageSize of ${pageSizeMB}MB\x1b[0m`);
                    // @TODO save existing file as another name
                    // @TODO Archive cache if necessary
                    return reject();
                }
                // resolved rejection is catchable
                return resolve(fs.readJson(this._dir));
            })
            .then(content => this.__initFromJson(content))
            .catch(error => {
                console.log('[StoreAbstract init] File not found or data file exceed pageSize');
                // File not exist, or file exceed
                return this.__init();
            });
        }
        return this.initPromise;
    }
    saveState() {
        if (!this._dir) return Bluebird.resolve(this.length);
        if (!this.__savePromise) {
            // leading execution
            this.__saveState();
        } else if (!this.__savePromise.isResolved()) return this.__savePromise;
        this.__savePromise = new Bluebird((resolve, reject) => {
            // trailing execution
            this.__saveTimeout = setTimeout(() => {
                this.__saveState();
                resolve(this.length);
            }, THROTTLE_INTERVAL);
        });
        return this.__savePromise;
    }
    __saveState() {
        console.log('[StoreAbstract __saveState]');
        return fs.writeFileSync(this._dir, this.__serialization());
    }
    __serialization() {
        // to be override
        throw new Error('[StoreAbstract] __serialization not override');
    }
    has() {  // Map & Set protocol
        return this.data.has.apply(this.data, arguments);
    }
    // @throwable - data not overwrittable
    // returns data itself
    add() {  // Map & Set protocol
        let result;
        if (this.data instanceof Set) {
            result = this.data.add.apply(this.data, arguments);
        } else if (this.data instanceof Map) {
            if (!this._isOverwrittable && this.has.apply(this, arguments)) throw new Error('[StoreAbstract add] data not overwrittable', Array.prototype.slice.call(arguments));
            result = this.data.set.apply(this.data, arguments);
        } else {
            console.log('[StoreAbstract add] ERROR: Unknown type of data structure', this.data);
            console.log('[StoreAbstract add] ERROR: Please make sure ready() is called!');
        }
        return this.saveState();
        // return result;
    }
    get() {  // Map protocol
        if (!(this.data instanceof Map)) return;
        return this.data.get.apply(this.data, arguments);
    }
    // Map & Set protocol
    get length() {
        return this.data.size;
    }
    abortSave() {
        this.__saveTimeout && clearTimeout(this.__saveTimeout);
        this.__savePromise && this.__savePromise.cancel();
        this.__saveTimeout = this.__savePromise = void 0;
    }
    clear() {
        this.__init(); // erase data
        this.saveState();
        return this;
    }
    // Immutable final: cannot handle intermediate abortSave()
    settle() {
        return this.__savePromise || Bluebird.resolve();
    }
    delete() {
        this.abortSave();
        console.log('[StoreAbstract delete] Files & records will be deleted permanently');
        // Aborting save may interrupt the creation of file
        // thus need to wrap the fs unlink in try-catch
        try {
            this._dir && fs.unlinkSync(this._dir);
        } catch(e) {}
        this.saveState = void 0;    // Unarm the capability of save
        console.log('[StoreAbstract delete] Please dereference this instance');
    }
}
module.exports = exports = StoreAbstract;