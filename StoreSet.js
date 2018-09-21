const
    StoreAbstract = require('./StoreAbstract');

class StoreSet extends StoreAbstract {
    __init() {
        console.log('[StoreSet __init]');
        this.data = new Set();
        return this;
    }
    __initFromJson(content) {
        console.log('[StoreSet __initFromJson]');
        this.data = new Set(content.set);
        return this;
    }
    __serialization() {
        let iterable = [];
        try {
            iterable = [...this.data];
        } catch(e) {
            console.log('[StoreSet __serialization] ERROR:', e, this.data);
        }
        return JSON.stringify({
            set: iterable
        });
    }
}
// Export module
module.exports = exports = StoreSet;