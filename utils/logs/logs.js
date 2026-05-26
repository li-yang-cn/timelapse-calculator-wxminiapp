module.exports = {
  debug() {
    console.debug.apply(console, arguments)
  },
  info() {
    console.info.apply(console, arguments)
  },
  warn() {
    console.warn.apply(console, arguments)
  },
  error() {
    console.error.apply(console, arguments)
  },
  setFilterMsg(msg) { // 从基础库2.7.3开始支持
    return msg
  },
  addFilterMsg(msg) { // 从基础库2.8.1开始支持
    return msg
  }
}
