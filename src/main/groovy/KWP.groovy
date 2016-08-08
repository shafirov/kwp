import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.ProjectDependency

import java.util.zip.ZipFile

class KWP implements Plugin<Project> {
    @Override
    void apply(Project target) {
        target.task(dependsOn: jar, 'webpack_loader') << {
            def dependencies = new LinkedHashSet<File>()
            def sources = new LinkedHashSet<String>()
            collectDependencies(project, sources, dependencies)

            def targetDir = new File(rootProject.buildDir, "kjs")
            targetDir.mkdirs()

            writeSafely(new File(targetDir, "__modules.js")) { buf ->
                dependencies.each {jar ->
                    def m = unzipSafely(jar, targetDir)
                    buf.append("require('${m.absolutePath}');\n")
                }
            }

            writeSafely(new File(targetDir, "__deps.txt")) { buf ->
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

        sources.add(new File(project.projectDir, "src/main/kotlin").getAbsolutePath())
    }

    File unzipSafely(File jar, File targetFolder) {
        def targetFile = new File(targetFolder, removeSuffix(jar.name, ".jar") + ".js")
        if (!targetFile.exists() || targetFile.lastModified() != jar.lastModified()) {
            ZipFile zip = new ZipFile(jar)
            def targets = 0
            for (zipEntry in zip.entries()) {
                if (zipEntry.isDirectory()) continue

                if (zipEntry.name.endsWith(".meta.js")) {
                    new File(targetFolder, zipEntry.name).text = zip.getInputStream(zipEntry).text
                    targets++
                }
                else if (zipEntry.name.endsWith(".js")) {
                    targetFile.text = zip.getInputStream(zipEntry).text
                    targets++
                }

                if (targets == 2) break
            }

            targetFile.setLastModified(jar.lastModified())
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
}
