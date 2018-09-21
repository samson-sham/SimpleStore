const
    StoreAbstract = require('./StoreAbstract');
    
class StoreMap extends StoreAbstract {
    __init() {
        console.log('[StoreMap __init]');
        this.data = new Map();
        return this;
    }
    __initFromJson(content) {
        console.log('[StoreMap __initFromJson]');
        this.data = new Map(content.map);
        return this;
    }
    __serialization() {
        return JSON.stringify({
            map: [...this.data]
        });
    }
}
module.exports = exports = StoreMap;