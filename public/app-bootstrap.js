/**
 * Vue 挂载前的同步引导：先应用主题，再为受限浏览器提供会话级存储兜底。
 * 保持为同源外部脚本，避免生产 CSP 放开内联脚本。
 */
;(function applyInitialTheme() {
  try {
    var value = localStorage.getItem('batch-console:theme')
    var dark
    if (value === 'dark') dark = true
    else if (value === 'light') dark = false
    else dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    if (dark) document.documentElement.classList.add('dark')
  } catch (_) {
    // localStorage 不可用时由下面的存储兜底接管。
  }
})()

;(function installStorageFallback() {
  try {
    var probeKey = '__ls_probe__'
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
  } catch (_) {
    var store = Object.create(null)
    var shim = {
      getItem: function (key) {
        return key in store ? store[key] : null
      },
      setItem: function (key, value) {
        store[key] = String(value)
      },
      removeItem: function (key) {
        delete store[key]
      },
      clear: function () {
        store = Object.create(null)
      },
      key: function (index) {
        return Object.keys(store)[index] || null
      },
    }
    Object.defineProperty(shim, 'length', {
      get: function () {
        return Object.keys(store).length
      },
    })
    try {
      Object.defineProperty(window, 'localStorage', {
        value: shim,
        writable: false,
        configurable: true,
      })
    } catch (_) {
      // 某些浏览器冻结了 window 属性，后续业务仍会走自身的错误处理。
    }
  }
})()
