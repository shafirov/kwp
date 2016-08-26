# kwp
webpack plugin for resolving modules produced by Kotlin.JS Gradle builds

This comes as Gradle plugin, which adds webpack_loader task to a project, which scans project jar artifacts for generated javascript files
as well as Webpack plugin, which declares an alias for each Kotlin module to it resulting javascript output. Webpack plugin is also watching
Kotlin sourcefiles and launches Webpack build appropriately.

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
        classpath "org.jetbrains.kwp:kwp:0.1.8"
    }
}
```

Then for the project you have ```compileKotlin2Js``` apply the plugin:
```gradle
    apply plugin: KWP
```

This is it for gradle part of setup. Now you need to hook up plugin (that comes with gradle distro) into webpack.config.js

```javascript
var KotlinWebpackPlugin = require('./build/kwp/kwp')

var webpackConfig = {
  ...
    plugins: [
      new KotlinWebpackPlugin({
        buildFile: './build.gradle',
        project: 'showcase'
      })
    ]
```

Then you can just require some Kotlin modules:

```javascript
require('showcase')
```
