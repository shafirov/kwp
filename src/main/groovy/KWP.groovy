import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.ProjectDependency

import java.util.zip.ZipFile

class KWP implements Plugin<Project> {
    private static def loaderText = KWP.class.getResourceAsStream("/kwp.js").text

    void installKwp(File targetDir, boolean force) {
        def file = new File(targetDir, "kwp.js")
        if (!file.exists() || force) {
            targetDir.mkdirs()
            writeSafely(file) { buf ->
                buf.append(loaderText)
            }
        }
    }

    @Override
    void apply(Project target) {
        def rootProject = target.rootProject
        def targetDir = new File(rootProject.buildDir, "kwp")

        rootProject.afterEvaluate {
            installKwp(targetDir, true)
        }

        rootProject.tasks['clean'] << {
            installKwp(targetDir, false)
        }

        target.task(dependsOn: 'jar', 'webpack_loader') << {
            def dependencies = new LinkedHashSet<File>()
            def sources = new LinkedHashSet<String>()
            collectDependencies(project, sources, dependencies)

            targetDir.mkdirs()

            writeSafely(new File(targetDir, "__modules.txt")) { buf ->
                dependencies.each {jar ->
                    def m = unzipSafely(jar, targetDir)
                    def moduleName = m.name.substring(0, m.name.lastIndexOf('.'))
                    buf.append("${ moduleName}:${normalizedAbsolutePath(m)}\n")
                }
            }

            writeSafely(new File(targetDir, "__sources.txt")) { buf ->
                sources.each {
                    buf.append("$it\n")
                }
            }
        }
    }

    void collectDependencies(Project project, Set<String> sources, Set<File> dependencies) {
        def configuration = project.configurations.findByName("default")
        configuration.allDependencies.each {
            if (it instanceof ProjectDependency) {
                collectDependencies(it.dependencyProject, sources, dependencies)
            }
        }

        dependencies.addAll(configuration.resolve())
        dependencies.addAll(configuration.allArtifacts.files)

        sources.add(normalizedAbsolutePath(new File(project.projectDir, "src/main/kotlin")))
    }

    File unzipSafely(File jar, File targetFolder) {
        def timestampFile = new File(targetFolder, jar.name + ".timestamp")
        def targetFile = null
        if (!timestampFile.exists() || timestampFile.lastModified() != jar.lastModified()) {
            ZipFile zip = new ZipFile(jar)
            def targets = 0
            for (zipEntry in zip.entries()) {
                if (zipEntry.isDirectory()) continue

                if (zipEntry.name.endsWith(".meta.js") || zipEntry.name.endsWith('.js.map')) {
                    new File(targetFolder, zipEntry.name).text = zip.getInputStream(zipEntry).text
                    targets++
                }
                else if (zipEntry.name.endsWith(".js")) {
                    targetFile = new File(targetFolder, zipEntry.name)
                    targetFile.text = zip.getInputStream(zipEntry).text
                    targets++
                }

                if (targets == 3) break
            }

            timestampFile.text = ""
            timestampFile.setLastModified(jar.lastModified())
        }

        return targetFile
    }

    String removeSuffix(String str, String suffix) {
        if (str.endsWith(suffix)) return str.substring(0, str.length() - suffix.length())
        return str
    }

    void writeSafely(File file, Closure<StringBuilder> builder) {
        def buffer = new StringBuilder()
        builder(buffer)
        def contents = buffer.toString()
        if (!file.exists() || file.text != contents) file.text = contents
    }

    String normalizedAbsolutePath(File file) {
        return file.absolutePath.replace('\\', '/')
    }
}
