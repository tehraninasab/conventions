open System.IO
#r "nuget: FSharp.Data, Version=5.0.2"
open FSharp.Data

let checkSuitsType = File.ReadAllText("scripts/checkSuitsType.json")
type Simple = JsonProvider<checkSuitsType>

let sample = File.ReadAllText("scripts/sample.json")
let value = Simple.Parse(sample)

printfn "value: %A" value
