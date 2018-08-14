const winston = require("winston");


/**
 * logger support 4 level
 * @info
 * @debug
 * @warn
 * @error
 */

class Logger {
  constructor(name, file, errorFile, level = 'info') {
    this.logger = winston.createLogger({
      level: level,
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  debug(...params) {
    this.logger.debug(...params);
  }

  info(...params) {
    this.logger.info(...params);
  }

  warn(...params) {
    this.logger.warning(...params);
  }

  error(...params) {
    this.logger.error(...params);
  }
}

module.exports = Logger;
