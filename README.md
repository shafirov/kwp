# kwp
webpack loader for javascript artifacts produced by Kotlin.JS Gradle builds

This comes as Gradle plugin, which adds webpack_loader task to a project, which scans project jar artifacts for generated javascript files
and generates a module to require them in proper order.

Also this provides a webpack loader, that handles build.gradle files and accepts gradle project name as query parameter to require request.

For example of usage please look at https://github.com/shafirov/kwp-sample
