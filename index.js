var stylus = require('stylus')

var url = require('url')
var path = require('path')
var fs = require('fs')

module.exports = function(options) {
    options = typeof options == 'string' ? {src:options} : (options || {})
    var src = options.src
    var watch = !options.cache
    var cache = {}
    var watchCallback = options.watchCallback

    function watchForChanges(imports, stylusPath) {
        var reloading = false
        var watchers = imports.map(function(filename) {
            return fs.watch(filename.path, { persistent:false }, function() {
                if (reloading) return
                reloading = true
                delete cache[stylusPath]
                getCss(stylusPath)
                watchers.forEach(function(watcher) { watcher.close() })
                watchCallback && watchCallback(stylusPath.substring(src.length))
            })
        })
    }
    function getCss(stylusPath, callback) {
        if (cache[stylusPath]) return callback && callback(null, cache[stylusPath])
        fs.readFile(stylusPath, 'utf8', function(error, stylusSource) {
            if (error) return callback && callback(error)
            var stylusOptions = {
                filename:stylusPath,
                compress:options.compress,
                linenos:options.linenos
            }
            if (watch) stylusOptions._imports = [{path:stylusPath}]
            var renderer = stylus(stylusSource, stylusOptions)
            if (options.setup) renderer = options.setup(renderer, stylusSource, stylusPath)
            renderer.render(function(error, css) {
                if (error) return callback && callback(error)
                if (watch) watchForChanges(stylusOptions._imports, stylusPath)
                cache[stylusPath] = css
                callback && callback(null, css)
            })
        })
    }
    return function stylus(request, response, next){
        if ('GET' != request.method && 'HEAD' != request.method) return next()
        var urlPath = url.parse(request.url).pathname
        if (!/\.(css|styl)$/.test(urlPath)) return next()
        var stylusPath = path.join(src, urlPath.replace(/\.css$/, '.styl'))
        getCss(stylusPath, function(error, css) {
            if (error) return next(error)
            response.header('Content-type', 'text/css')
            response.send(css)
        })
    }
}