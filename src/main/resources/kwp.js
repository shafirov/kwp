var path = require("path");
var fs = require('fs')
var exec = require('child_process').exec

var isWin = /^win/.test(process.platform);

module.exports = function(content) {
    var loader = this
    loader.cacheable()
    var callback = loader.async()

    var fail = function(message) {
        callback(message)
    }

    var success = function (res, map) {
        callback(null, res, map)
    }

    var buildFile = path.resolve(loader.resourcePath);
    var project = loader.resourceQuery.substr(1)

    var gradle = "./gradlew"
    if (isWin) {
        gradle += ".bat"
    }

    gradle = path.resolve(gradle)
    if (!gradle) {
        fail("Cannot find ./gradlew")
        return
    }

    if (!buildFile) {
        fail("Cannot resolve build file: " + buildArg)
        return
    }

    console.time("Done Gradle")
    var cmdline = gradle + " " + "--build-file " + buildFile + " " + project + ":webpack_loader";
    console.log("Running Gradle: " + cmdline)

    exec(cmdline, function(err, stdout, stderr) {
        console.log(stderr)
        if (err) {
            console.log(stdout)
            fail(err)
        }
        else {
            // console.log(stdout)
            var deps = fs.readFileSync(path.resolve('build/kwp/__deps.txt'), "UTF-8").split("\n")

            for (var i = 0; i < deps.length; i++) {
                var t = deps[i].trim()
                if (t.length > 0) {
                    loader.addContextDependency(t)
                }
            }

            success(fs.readFileSync(path.resolve('build/kwp/__modules.js'), "UTF-8"))
            console.timeEnd("Done Gradle")
        }
    })
}
