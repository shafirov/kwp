# kwp
webpack loader for javascript artifacts produced by Kotlin.JS Gradle builds

This comes as Gradle plugin, which adds webpack_loader task to a project, which scans project jar artifacts for generated javascript files
and generates a module to require them in proper order.

Also this provides a webpack loader, that handles build.gradle files and accepts gradle project name as query parameter to require request.

For example of usage please look at https://github.com/shafirov/kwp-sample

Setting up:
First, add repository and buildscript classpath dependency to be able to apply the plugin:
```gradle
buildscript {
    repositories {
        maven {
            url "https://dl.bintray.com/shafirov/kwp"
        }
    }

    dependencies {
        classpath "org.jetbrains.kwp:kwp:0.1.4"
    }
}
```

Then for the project you have ```compileKotlin2Js``` apply the plugin:
```gradle
    apply plugin: KWP
```

This is it for gradle part of setup. Now you need to hook up a loader that comes with gradle into webpack.config.js and
define ```Kotlin``` global via ProvidePlugin.

```javascript
var path = require('path');

var webpackConfig = {
  ...
  module: {
    loaders: [
      {
        test: /\.gradle\?.*$/,
        loaders: [
          './build/kwp/kwp'
        ]
      }
    ]
  }

  ...

    plugins: [
      new webpack.ProvidePlugin({
        Kotlin: path.join(__dirname, 'build/kwp/kotlin-js-library-1.0.2-1.js')
      })
    ]
```

As of Kotlin 1.0.3 Kotlin.js modules do not export anything so you won't be able to use Kotlin code from javascript modules easily.
So you just require some Kotlin modules to be included in webpack build target for now:

```javascript
require('./build.gradle?projectname')
```
