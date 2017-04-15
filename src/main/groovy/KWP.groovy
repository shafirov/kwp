import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.artifacts.ProjectDependency

import java.util.zip.ZipFile

class KWP implements Plugin<Project> {

    @Override
    void apply(Project target) {
        def rootProject = target.rootProject
        def targetDir = new File(rootProject.buildDir, "kwp")

        target.task(dependsOn: "jar", "kwp") {
            doLast {
                def dependencies = new LinkedHashSet<File>()
                collectDependencies(project, dependencies)

                dependencies.each {jar ->
                    unzipSafely(jar, targetDir)
                }
            }
        }
    }

    void collectDependencies(Project project, Set<File> dependencies) {
        def configuration = project.configurations.findByName("default")
        configuration.allDependencies.each {
            if (it instanceof ProjectDependency) {
                collectDependencies(it.dependencyProject, dependencies)
            }
        }

        dependencies.addAll(configuration.resolve())
        dependencies.addAll(configuration.allArtifacts.files)
    }

    void unzipSafely(File jar, File targetFolder) {
        def timestampFile = new File(targetFolder, jar.name + ".timestamp")
        if (!timestampFile.exists() || timestampFile.lastModified() != jar.lastModified()) {
            ZipFile zip = new ZipFile(jar)
            for (zipEntry in zip.entries()) {
                if (zipEntry.isDirectory()) continue

                if (zipEntry.name.endsWith(".js") || zipEntry.name.endsWith('.js.map')) {
                    writeSafely(new File(targetFolder, zipEntry.name), zip.getInputStream(zipEntry).text)
                }
            }

            writeSafely(timestampFile, jar.lastModified().toString())
            timestampFile.setLastModified(jar.lastModified())
        }
    }

    String removeSuffix(String str, String suffix) {
        if (str.endsWith(suffix)) return str.substring(0, str.length() - suffix.length())
        return str
    }

    void writeSafely(File file, String contents) {
        if (!file.exists() || file.text != contents) {
            file.getParentFile().mkdirs()
            file.text = contents
        }
    }

    void writeSafely(File file, Closure<StringBuilder> builder) {
        def buffer = new StringBuilder()
        builder(buffer)
        writeSafely(file, buffer.toString())
    }
}
