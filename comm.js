'use strict';

let config = require('./config');

class Cm {
    get config(){
        return this.cfg || config;
    }
    setConfig(config){
        this.cfg = config;
    }
}
module.exports = new Cm();