#!/usr/bin/env -S dotnet fsi

#r "nuget: Fsdk, Version=0.6.0--date20230214-0422.git-1ea6f62"
#load "../src/FileConventions/Helpers.fs"

open System
open System.IO

open Fsdk
open Fsdk.Process

open Helpers

let fantomlessToolVersion = "4.7.997-prerelease"
let prettierVersion = "2.8.3"
let pluginXmlVersion = "v2.2.0"

let StyleFSharpFiles(rootDir: DirectoryInfo) =
    InstallFantomlessTool fantomlessToolVersion

    Process
        .Execute(
            {
                Command = "dotnet"
                Arguments = $"fantomless --recurse {rootDir.FullName}"
            },
            Echo.Off
        )
        .UnwrapDefault()
    |> ignore

let StyleCSharpFiles(rootDir: DirectoryInfo) =
    Process
        .Execute(
            {
                Command = "dotnet"
                Arguments = $"format whitespace {rootDir.FullName} --folder"
            },
            Echo.Off
        )
        .UnwrapDefault()
    |> ignore

let StyleXamlFiles() =
    InstallPrettier prettierVersion
    InstallPrettierPluginXml pluginXmlVersion

    Process
        .Execute(
            {
                Command = "npm"
                Arguments =
                    $"install --save-dev prettier@{prettierVersion} @prettier/plugin-xml@{pluginXmlVersion}"
            },
            Echo.Off
        )
        .UnwrapDefault()
    |> ignore

    let pattern = $"**{Path.DirectorySeparatorChar}*.xaml"

    Process
        .Execute(
            {
                Command =
                    Path.Combine(
                        Directory.GetCurrentDirectory(),
                        "node_modules",
                        ".bin",
                        "prettier"
                    )

                Arguments =
                    $"--xml-whitespace-sensitivity ignore --tab-width 4 --prose-wrap preserve --write {pattern}"
            },
            Echo.Off
        )
        .UnwrapDefault()
    |> ignore

let StyleTypeScriptFiles() =
    let pattern =
        $"{Directory.GetCurrentDirectory()}{Path.DirectorySeparatorChar}**{Path.DirectorySeparatorChar}*.ts"

    RunPrettier $"--quote-props=consistent --write {pattern}"

let StyleYmlFiles() =
    let pattern =
        $"{Directory.GetCurrentDirectory()}{Path.DirectorySeparatorChar}**{Path.DirectorySeparatorChar}*.yml"

    RunPrettier $"--quote-props=consistent --write {pattern}"

let ContainsFiles (rootDir: DirectoryInfo) (searchPattern: string) =
    Helpers.GetFiles rootDir searchPattern |> Seq.length > 0

let GitDiff() : ProcessResult =

    // Since we changed file modes in the prettier step we need the following command to
    // make git ignore mode changes in files and doesn't include them in the git diff command.
    Process
        .Execute(
            {
                Command = "git"
                Arguments = "config core.fileMode false"
            },
            Echo.Off
        )
        .UnwrapDefault()
    |> ignore

    let processResult =
        Process.Execute(
            {
                Command = "git"
                Arguments = "diff --exit-code"
            },
            Echo.Off
        )

    processResult

let GitRestore() =
    Process
        .Execute(
            {
                Command = "git"
                Arguments = "restore ."
            },
            Echo.Off
        )
        .UnwrapDefault()
    |> ignore

let CheckStyleOfFSharpFiles(rootDir: DirectoryInfo) : bool =
    let suggestion =
        Some "Please style your F# code using: `dotnet fantomless --recurse .`"

    GitRestore()

    let success =
        if ContainsFiles rootDir "*.fs" || ContainsFiles rootDir ".fsx" then
            StyleFSharpFiles rootDir
            let processResult = GitDiff()
            UnwrapProcessResult suggestion true processResult |> ignore
            IsProcessSuccessful processResult

        else
            true

    success

let CheckStyleOfTypeScriptFiles(rootDir: DirectoryInfo) : bool =
    let pattern =
        $".{Path.DirectorySeparatorChar}**{Path.DirectorySeparatorChar}*.ts"

    let suggestion =
        Some
            $"Please style your TypeScript code using: `npx prettier --quote-props=consistent --write {pattern}`"

    GitRestore()

    let success =
        if ContainsFiles rootDir "*.ts" then
            InstallPrettier prettierVersion
            StyleTypeScriptFiles()
            let processResult = GitDiff()
            UnwrapProcessResult suggestion true processResult |> ignore
            IsProcessSuccessful processResult

        else
            true

    success

let CheckStyleOfYmlFiles(rootDir: DirectoryInfo) : bool =
    let pattern =
        $".{Path.DirectorySeparatorChar}**{Path.DirectorySeparatorChar}*.yml"

    let suggestion =
        Some
            $"Please style your YML code using: `npx prettier --quote-props=consistent --write {pattern}`"

    GitRestore()

    let success =
        if ContainsFiles rootDir "*.yml" then
            InstallPrettier prettierVersion
            StyleYmlFiles()
            let processResult = GitDiff()
            UnwrapProcessResult suggestion true processResult |> ignore
            IsProcessSuccessful processResult
        else
            true

    success

let CheckStyleOfCSharpFiles(rootDir: DirectoryInfo) : bool =
    let suggestion =
        Some
            "Please style your C# code using: `dotnet format whitespace . --folder"

    GitRestore()

    let success =
        if ContainsFiles rootDir "*.cs" then
            StyleCSharpFiles rootDir
            let processResult = GitDiff()
            UnwrapProcessResult suggestion true processResult |> ignore
            IsProcessSuccessful processResult
        else
            true

    success

let CheckStyleOfXamlFiles(rootDir: DirectoryInfo) : bool =
    let prettierPath = Path.Combine(".", "node_modules", ".bin", "prettier")

    let pattern = $"**{Path.DirectorySeparatorChar}*.xaml"

    let suggestion =
        "Please style your XAML code using:"
        + Environment.NewLine
        + $"`{prettierPath} --xml-whitespace-sensitivity ignore --tab-width 4 --prose-wrap preserve --write {pattern}`"
        |> Some

    GitRestore()

    let success =
        if ContainsFiles rootDir "*.xaml" then
            StyleXamlFiles()
            let processResult = GitDiff()
            UnwrapProcessResult suggestion true processResult |> ignore
            IsProcessSuccessful processResult
        else
            true

    success

let rootDir = Path.Combine(__SOURCE_DIRECTORY__, "..") |> DirectoryInfo

let processSuccessStates =
    [|
        CheckStyleOfFSharpFiles rootDir
        CheckStyleOfCSharpFiles rootDir
        CheckStyleOfTypeScriptFiles rootDir
        CheckStyleOfYmlFiles rootDir
        CheckStyleOfXamlFiles rootDir
    |]

if processSuccessStates |> Seq.contains false then
    Environment.Exit 1
