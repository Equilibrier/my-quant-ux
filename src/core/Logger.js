class Logger {

  constructor () {
      this.logLevel = 4
  }

  setLogLevel (l) {
      console.debug('SetLogLevel', l)
      this.logLevel = l
  }

  warn(msg, obj) {
      if (obj !== undefined) {
          console.warn(msg, obj)
      } else {
          console.warn(msg)
      }
  }
  error(msg, obj) {
      if (obj !== undefined) {
          console.error(msg, obj)
      } else {
          console.error(msg)
      }
  }
  log(level, msg, obj, obj2 = '') {
      if (level < this.logLevel) {
          if (obj !== undefined) {
              console.debug(msg, obj, obj2)
          } else {
              console.debug(msg)
          }
      }
  }
}
export default new Logger()