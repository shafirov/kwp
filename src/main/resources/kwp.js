var path = require("path");
var fs = require('fs')
var execSync = require('child_process').execSync
var isWin = /^win/.test(process.platform);

var ModuleAliasPlugin = require("webpack/node_modules/enhanced-resolve/lib/ModuleAliasPlugin");

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
                recursive: true
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
