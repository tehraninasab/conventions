#!/usr/bin/env -S dotnet fsi

open System
open System.IO

#r "nuget: YamlDotNet, Version=13.1.0"
#load "../src/FileConventions/Library.fs"
#load "../src/FileConventions/Helpers.fs"

let rootDir = Path.Combine(__SOURCE_DIRECTORY__, "..") |> DirectoryInfo

let invalidFiles =
    Helpers.GetInvalidFiles rootDir "*.*" FileConventions.MixedLineEndings

Helpers.AssertNoInvalidFiles
    invalidFiles
    "The following files shouldn't use mixed line endings:"
