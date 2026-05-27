var log = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null

function getArgs(args) {
  return Array.prototype.slice.call(args)
}

module.exports = {
  debug() {
    const args = getArgs(arguments)
    if (!log) return
    log.debug.apply(log, args)
  },
  info() {
    const args = getArgs(arguments)
    if (log) {
      log.info.apply(log, args)
    }
    console.info.apply(console, args)
  },
  warn() {
    const args = getArgs(arguments)
    if (!log) return
    log.warn.apply(log, args)
  },
  error() {
    const args = getArgs(arguments)
    if (!log) return
    log.error.apply(log, args)
  },
  setFilterMsg(msg) { // 从基础库2.7.3开始支持
    if (!log || !log.setFilterMsg) return
    if (typeof msg !== 'string') return
    log.setFilterMsg(msg)
  },
  addFilterMsg(msg) { // 从基础库2.8.1开始支持
    if (!log || !log.addFilterMsg) return
    if (typeof msg !== 'string') return
    log.addFilterMsg(msg)
  }
}
