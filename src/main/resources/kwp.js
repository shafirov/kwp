var path = require("path");
var fs = require('fs')
var execSync = require('child_process').execSync
var isWin = /^win/.test(process.platform);
var isMacOs = 'darwin' == process.platform;

/**
 * Node-watch npm package https://github.com/yuanchuan/node-watch
 * MIT license http://www.opensource.org/licenses/mit-license.php
 * Copyright (c) 2012-2016 Yuan Chuan <yuanchuan23@gmail.com>
 */
var watch = (function () {
    /**
     *  Module dependencies.
     */
    var fs   = require('fs')
        , path = require('path')
        , events = require('events');


    /**
     * Utility functions to synchronously test whether the giving path
     * is a file or a directory or a symbolic link.
     */
    var is = function(ret) {
        var shortcuts = {
            'file': 'File'
            , 'dir': 'Directory'
            , 'sym': 'SymbolicLink'
        };
        Object.keys(shortcuts).forEach(function(method) {
            var stat = fs[method === 'sym' ? 'lstatSync' :'statSync'];
            ret[method] = function(fpath) {
                try {
                    var yes = stat(fpath)['is' + shortcuts[method]]();
                    memo.push(fpath, method);
                    return yes;
                } catch(e) {}
            }
        });
        return ret;
    }({});


    /**
     *  Get sub-directories in a directory.
     */
    var sub = function(parent, cb) {
        if (is.dir(parent)) {
            fs.readdir(parent, function(err, all) {
                all && all.forEach(function(f) {
                    var sdir = path.join(parent, f);
                    if (is.dir(sdir)) {
                        cb.call(null, sdir)
                    }
                });
            });
        }
    };


    /**
     *  Mixing object properties.
     */
    var mixin = function() {
        var mix = {};
        [].forEach.call(arguments, function(arg) {
            for (var name in arg) {
                if (arg.hasOwnProperty(name)) {
                    mix[name] = arg[name];
                }
            }
        });
        return mix;
    };


    /**
     * A container for memorizing names of files or directories.
     */
    var memo = function(memo) {
        return {
            push: function(name, type) {
                memo[name] = type;
            },
            has: function(name) {
                return {}.hasOwnProperty.call(memo, name);
            },
            update: function(name) {
                if (!is.file(name) || !is.dir(name)) {
                    delete memo[name];
                }
                return true;
            }
        };
    }({});


    /**
     *  A Container for storing unique and valid filenames.
     */
    var fileNameCache = function(cache) {
        return {
            push: function(name) {
                cache[name] = 1;
                return this;
            },
            each: function() {
                var temp = Object.keys(cache).filter(function(name){
                    return is.file(name) || memo.has(name) && memo.update(name);
                });
                temp.forEach.apply(temp, arguments);
                return this;
            },
            clear: function(){
                cache = {};
                return this;
            }
        };
    }({});


    /**
     * Abstracting the way of avoiding duplicate function call.
     */
    var worker = function() {
        var free = true;
        return {
            busydoing: function(cb) {
                if (free) {
                    free = false;
                    cb.call();
                }
            },
            free: function() {
                free = true;
            }
        }
    }();


    /**
     * Delay function call and ignore invalid filenames.
     */
    var normalizeCall = function(fname, options, cb, watcher) {
        // Store each name of the modifying or temporary files generated by an editor.
        fileNameCache.push(fname);

        worker.busydoing(function() {
            // A heuristic delay of the write-to-file process.
            setTimeout(function() {

                // When the write-to-file process is done, send all filtered filenames
                // to the callback function and call it.
                fileNameCache
                    .each(function(f) {
                        // Watch new created directory.
                        if (options.recursive && !memo.has(f) && is.dir(f)) {
                            watch(f, options, cb, watcher);
                        }
                        cb && cb.call(null, f);
                        watcher.emit('change', f);
                    }).clear();

                worker.free();

            }, 100);
        });
    };


    /**
     * Watcher class to simulate FSWatcher
     */
    var Watcher = function Watcher() {
        this.watchers = [];
        this.closed = false;
        this.close = function() {
            this.watchers.forEach(function(watcher) {
                watcher.close();
            });
            this.watchers = [];
            this.closed = true;
        };
        this.addWatcher = function(watcher, cb) {
            var self = this;
            this.watchers.push(watcher);

            watcher.on('error', function(err) {
                self.emit('error', err);
            });
        };
    };

    Watcher.prototype.__proto__ = events.EventEmitter.prototype;


    /**
     * Option handler for the `watch` function.
     */
    var handleOptions = function(origin, defaultOptions) {
        return function() {
            var args = [].slice.call(arguments);
            args[3] = new Watcher;
            if (Object.prototype.toString.call(args[1]) === '[object Function]') {
                args[2] = args[1];
            }
            if (!Array.isArray(args[0])) {
                args[0] = [args[0]];
            }
            //overwrite default options
            args[1] = mixin(defaultOptions, args[1]);
            //handle multiple files.
            args[0].forEach(function(path) {
                origin.apply(null, [path].concat(args.slice(1)));
            });
            return args[3];
        }
    };


    /**
     * Ignore the recursive option on platforms which natively support it,
     * or temporarily set it to false for optimization.
     */
    var noRecursive = function(option) {
        return mixin(option, { recursive: false });
    };


    /**
     * Watch a file or a directory (recursively by default).
     *
     * @param {String} fpath
     * @options {Object} options
     * @param {Function} cb
     *
     * Options:
     *   `recursive`:      Watch it recursively or not (defaults to true).
     *   `followSymLinks`: Follow symbolic links or not (defaults to false).
     *   `maxSymLevel`:    The max number of following symbolic links (defaults to 1).
     *   `filter`:         Filter function(fullPath:string) => boolean (defaults to () => true ).
     *
     * Example:
     *
     *   watch('fpath', { recursive: true }, function(file) {
 *     console.log(file, ' changed');
 *   });
     */
    function watch(fpath, options, cb, watcher) {
        var skip = watcher.closed || !options.filter(fpath) || (
                is.sym(fpath) && !(options.followSymLinks && options.maxSymLevel--)
            );
        if (skip) return;

        // Due to the unstable fs.watch(), if the `fpath` is a file then
        // switch to watch its parent directory instead of watch it directly.
        // Once the logged filename matches it then triggers the callback function.
        if (is.file(fpath)) {
            var parent = path.resolve(fpath, '..');
            watcher.addWatcher(fs.watch(parent, noRecursive(options)).on('change', function(evt, fname) {
                if (path.basename(fpath) === fname) {
                    normalizeCall(fname, options, cb, watcher);
                }
            }), cb);
        }
        else if (is.dir(fpath)) {
            watcher.addWatcher(fs.watch(fpath, noRecursive(options)).on('change', function(evt, fname) {
                normalizeCall(path.join(fpath, fname), options, cb, watcher);
            }), cb);

            if (options.recursive) {
                // Recursively watch its sub-directories.
                sub(fpath, function(dir) {
                    watch(dir, options, cb, watcher);
                });
            }
        }
    }

    /**
     * Set default options and expose.
     */
    return handleOptions(watch, {
        recursive: true
        , followSymLinks: false
        , maxSymLevel: 1
        , filter: function(fullPath) { return true; }
    });
})()


/* ##### MODULE ALIAS PLUGIN COPY-PASTED SO THIS DOESN"T HAVE ANY DEPENDENCIES

  MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */

function createInnerCallback(callback, options, message) {
    var log = options.log;
    if(!log) {
        if(options.stack !== callback.stack) {
            function callbackWrapper() {
                return callback.apply(this, arguments);
            }
            callbackWrapper.stack = options.stack;
            callbackWrapper.missing = options.missing;
        }
        return callback;
    }
    function loggingCallbackWrapper() {
        log(message);
        for(var i = 0; i < theLog.length; i++)
            log("  " + theLog[i]);
        return callback.apply(this, arguments);
    }
    var theLog = [];
    loggingCallbackWrapper.log = function writeLog(msg) {
        theLog.push(msg);
    };
    loggingCallbackWrapper.stack = options.stack;
    loggingCallbackWrapper.missing = options.missing;
    return loggingCallbackWrapper;
}

function ModuleAliasPlugin(aliasMap) {
    this.aliasMap = aliasMap;
}
ModuleAliasPlugin.prototype.apply = function(resolver) {
    var aliasMap = this.aliasMap;
    resolver.plugin("module", function(request, callback) {
        var fs = this.fileSystem;
        var keys = Object.keys(aliasMap);
        var i = 0;
        (function next() {
            for(;i < keys.length; i++) {
                var aliasName = keys[i];
                var onlyModule = /\$$/.test(aliasName);
                if(onlyModule) aliasName = aliasName.substr(0, aliasName.length-1);
                if((!onlyModule && request.request.indexOf(aliasName + "/") === 0) || request.request === aliasName) {
                    var aliasValue = aliasMap[keys[i]];
                    if(request.request.indexOf(aliasValue + "/") !== 0 && request.request != aliasValue) {
                        var newRequestStr = aliasValue + request.request.substr(aliasName.length);
                        var newRequest = this.parse(newRequestStr);
                        var obj = {
                            path: request.path,
                            request: newRequest.path,
                            query: newRequest.query,
                            directory: newRequest.directory
                        };
                        var newCallback = createInnerCallback(callback, callback, "aliased with mapping " + JSON.stringify(aliasName) + ": " + JSON.stringify(aliasValue) + " to " + newRequestStr);
                        if(newRequest.module) return this.doResolve("module", obj, newCallback);
                        if(newRequest.directory) return this.doResolve("directory", obj, newCallback);
                        return this.doResolve(["file", "directory"], obj, newCallback);
                    }
                }
            }
            return callback();
        }.call(this));
    });
};

function KotlinWebpackPlugin(options) {
    this.options = options
}

KotlinWebpackPlugin.prototype.apply = function (compiler) {
    var buildFile = path.resolve(compiler.context, this.options.buildFile)
    if (!buildFile) {
        console.error("Cannot resolve build file: ", this.options.buildFile)
        return
    }

    var project = this.options.project
    if (!project) {
        console.error("kwp needs 'buildFile' and 'project' properties specified")
        return
    }

    var root = path.join(buildFile, "../")
    var gradle = path.join(root, "gradlew")
    if (isWin) {
        gradle += ".bat"
    }

    gradle = path.resolve(gradle)
    if (!gradle) {
        console.error("Cannot find ./gradlew")
        return
    }

    var cmdline = gradle + " " + "--build-file " + buildFile + " " + project + ":webpack_loader";

    var running = false
    function execGradle() {
        if (running) return

        running = true
        try {
            console.log("\nRunning Gradle: " + cmdline)
            console.time("Done Gradle")
            var stdout = execSync(cmdline)
            // console.log(stdout)
            console.timeEnd("Done Gradle")
        } catch (err) {
            console.error("Gradle task ended with an error", err)
        } finally {
            running = false
        }
    }

    execGradle()

    var deps = fs.readFileSync(path.join(root, 'build/kwp/__sources.txt'), "UTF-8").split("\n")
    for (var i = 0; i < deps.length; i++) {
        var t = deps[i].trim()
        if (t.length > 0) {
            var watchFn = isWin || isMacOs ? fs.watch : watch
            watchFn(t, {
                recursive: true,
                persistent: false
            }, execGradle)
        }
    }

    var aliasMap = {}
    var modules = fs.readFileSync(path.join(root, 'build/kwp/__modules.txt'), "UTF-8").split("\n")
    for (var i = 0; i < modules.length; i++) {
        var line = modules[i].trim()
        if (line.length > 0) {
            var sep = line.indexOf(':')
            var m_name = line.substring(0, sep).trim()
            var m_path = line.substring(sep + 1).trim()

            aliasMap[m_name] = m_path
        }
    }

    compiler.resolvers.normal.apply(new ModuleAliasPlugin(aliasMap))
}

module.exports = KotlinWebpackPlugin
