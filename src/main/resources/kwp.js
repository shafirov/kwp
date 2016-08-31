var path = require("path");
var fs = require('fs')
var execSync = require('child_process').execSync
var isWin = /^win/.test(process.platform);


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
        console.log("\nRunning Gradle: " + cmdline)
        console.time("Done Gradle")
        var stdout = execSync(cmdline)
        // console.log(stdout)
        console.timeEnd("Done Gradle")
        running = false
    }

    execGradle()

    var deps = fs.readFileSync(path.join(root, 'build/kwp/__sources.txt'), "UTF-8").split("\n")
    for (var i = 0; i < deps.length; i++) {
        var t = deps[i].trim()
        if (t.length > 0) {
            fs.watch(t, {
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
