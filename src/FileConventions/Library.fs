﻿module FileConventions

open System
open System.IO
open System.Linq
open System.Text.RegularExpressions

let HasCorrectShebang(fileInfo: FileInfo) =
    let fileText = File.ReadLines fileInfo.FullName

    if fileText.Any() then
        let firstLine = fileText.First()

        firstLine.StartsWith "#!/usr/bin/env fsx"
        || firstLine.StartsWith "#!/usr/bin/env -S dotnet fsi"

    else
        false

let MixedLineEndings(fileInfo: FileInfo) =
    let fileText = File.ReadAllText fileInfo.FullName

    let lf = Regex("[^\r]\n", RegexOptions.Compiled)
    let cr = Regex("\r[^\n]", RegexOptions.Compiled)
    let crlf = Regex("\r\n", RegexOptions.Compiled)

    let numberOfLineEndings =
        [
            lf.IsMatch fileText
            cr.IsMatch fileText
            crlf.IsMatch fileText
        ]
        |> Seq.filter(
            function
            | isMatch -> isMatch = true
        )
        |> Seq.length

    numberOfLineEndings > 1

let DetectUnpinnedVersionsInGitHubCI(fileInfo: FileInfo) =
    assert (fileInfo.FullName.EndsWith(".yml"))

    let fileText = File.ReadAllText fileInfo.FullName

    let latestTagInRunsOnRegex =
        Regex("runs-on: .*-latest", RegexOptions.Compiled)

    latestTagInRunsOnRegex.IsMatch fileText

let DetectAsteriskInPackageReferenceItems(fileInfo: FileInfo) =
    assert (fileInfo.FullName.EndsWith "proj")

    let fileText = File.ReadAllText fileInfo.FullName

    let asteriskInPackageReference =
        Regex(
            "<PackageReference.*Version=\".*\*.*\".*/>",
            RegexOptions.Compiled
        )

    asteriskInPackageReference.IsMatch fileText

let DetectMissingVersionsInNugetPackageReferences(fileInfo: FileInfo) =
    assert (fileInfo.FullName.EndsWith ".fsx")

    let fileLines = File.ReadLines fileInfo.FullName

    not(
        fileLines
        |> Seq.filter(fun line -> line.StartsWith "#r \"nuget:")
        |> Seq.filter(fun line -> not(line.Contains ","))
        |> Seq.isEmpty
    )

let HasBinaryContent(fileInfo: FileInfo) =
    let lines = File.ReadLines fileInfo.FullName

    lines
    |> Seq.map(fun line ->
        line.Any(fun character ->
            Char.IsControl character && character <> '\r' && character <> '\n'
        )
    )
    |> Seq.contains true

type EolAtEof =
    | True
    | False
    | NotApplicable

let EolAtEof(fileInfo: FileInfo) =
    if HasBinaryContent fileInfo then
        NotApplicable
    else
        use streamReader = new StreamReader(fileInfo.FullName)
        let filetext = streamReader.ReadToEnd()

        if filetext <> String.Empty then
            if Seq.last filetext = '\n' then
                True
            else
                False
        else
            True

let DetectInconsistentVersionsInGitHubCIWorkflow(fileInfos: seq<FileInfo>) =
    fileInfos
    |> Seq.iter(fun fileInfo -> assert (fileInfo.FullName.EndsWith ".yml"))

    let inconsistentPulumiVersions =
        fileInfos
        |> Seq.map(fun fileInfo -> File.ReadLines fileInfo.FullName)
        |> Seq.map(fun fileLines ->
            fileLines
            |> Seq.filter(fun line -> line.Contains "pulumi-version:")
            |> Seq.map(fun line -> line.Substring(line.IndexOf(":") + 1))
            |> Seq.map(fun line -> line.Trim())
        )
        |> Seq.concat
        |> Set.ofSeq
        |> Seq.length
        |> (fun length -> length > 1)

    let versionRegex = Regex("\\s([^\\s]*)@([^\\s]*)\\s", RegexOptions.Compiled)

    let mutable versionMap: Map<string, Set<string>> = Map.empty

    let addSet (value: string) (prevSet: option<Set<string>>) =
        match prevSet with
        | Some pSet -> Some(Set.add value pSet)
        | None -> None

    fileInfos
    |> Seq.iter(fun fileInfo ->
        let fileText = File.ReadAllText fileInfo.FullName

        versionRegex.Matches fileText
        |> Seq.iter(fun regexMatch ->
            let key = regexMatch.Groups.[1].ToString()
            let value = regexMatch.Groups.[2].ToString()

            if versionMap.ContainsKey key then
                versionMap <- versionMap.Change(key, addSet value)
            else
                versionMap <- versionMap.Add(key, Set.singleton value)
        )
    )

    let inconsistentVersions =
        versionMap
        |> Seq.map(fun item -> Seq.length item.Value > 1)
        |> Seq.contains true

    inconsistentPulumiVersions || inconsistentVersions

let DetectInconsistentVersionsInGitHubCI(dir: DirectoryInfo) =
    let ymlFiles = dir.GetFiles("*.yml", SearchOption.AllDirectories)

    if Seq.length ymlFiles = 0 then
        false
    else
        DetectInconsistentVersionsInGitHubCIWorkflow ymlFiles
