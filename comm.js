'use strict';

let config = require('./config');

class Cm {
    get config(){
        return this.cfg || config;
    }
    setConfig(config){
        this.cfg = config;
    }
    getLogger(name){
        return config.getLogger(name);
    }
}
module.exports = new Cm();