const github = require('@actions/github');
const core = require('@actions/core');
const YAML = require('yaml')


options = { noCheckFiles: ["subber/namespace.yml"], noCheckPath: { "dummy.yaml": ["my/annoying/*"] } }
summery = new Map();

var jsonDiffPatch = require('jsondiffpatch')
var diffPatcher = jsonDiffPatch.create({
  // used to match objects when diffing arrays, by default only === operator is used
  objectHash: function (obj) {
    // this function is used only to when objects are not equal by ref
    return obj._id || obj.id;
  },
  arrays: {
    // default true, detect items moved inside the array (otherwise they will be registered as remove+add)
    detectMove: true,
    // default false, the value of items moved is not included in deltas
    includeValueOnMove: false
  },
  textDiff: {
    // default 60, minimum string length (left and right sides) to use text diff algorythm: google-diff-match-patch
    minLength: 60
  },
  propertyFilter: function (name, context) {
    /*
     this optional function can be specified to ignore object properties (eg. volatile data)
      name: property name, present in either context.left or context.right objects
      context: the diff context (has context.left and context.right objects)
    */
    return name.slice(0, 1) !== '$';
  },
  cloneDiffValues: false /* default false. if true, values in the obtained delta will be cloned
      (using jsondiffpatch.clone by default), to ensure delta keeps no references to left or right objects. this becomes useful if you're diffing and patching the same objects multiple times without serializing deltas.
      instead of true, a function can be specified here to provide a custom clone(value)
      */
});






async function getContent(contentRequest, octokit) {
  var resultOld = await octokit.rest.repos.getContent(contentRequest);
  console.log("oldFileResult: " + resultOld)
  if (!resultOld) {
    console.log("old result was empty")
    return null
  }
  const contentOld = Buffer.from(resultOld.data.content, 'base64').toString();
  console.log(contentRequest, contentOld)
  return YAML.parse(contentOld)

}

function validateDiff(delta, filename) {
  //is there a whitelist entry
  if (options.noCheckPath[filename] == undefined) {
    return { result: false, msg: "no noCheckPath found for this file " + filename }
  }


  paths = options.noCheckPath[filename]
  console.log("ℹ working with noCheckPath", paths);
  console.log("ℹ current diff is", delta)

  return { result: false, msg: "nothing fit" }
}

function setResult(filename, result, reason) {
  summery.set(filename, { result: result, reason: reason })
}
function printSummery() {

  console.log("########### result ##########");

  summery.forEach((key, value) => {
    console.log(`File ${key} was ${value.reason} ${value.result ? "✔" : "✖"}`)
  });
}


// most @actions toolkit packages have async methods
async function run() {
  try {

    console.log("hi there ⚠");

    //getting base information
    const myToken = core.getInput('myToken');
    const octokit = github.getOctokit(myToken)
    const context = github.context;


    if (context.eventName != "pull_request") {
      console.log("this pipeline is only for pull requests")
      return
    }
    //getting pr related information
    const payload = context.payload
    const repository = payload.repository

    org = repository.owner.login
    repo = repository.name
    pull_number = payload.number
    filesChanged = payload.pull_request.changed_files

    console.log("ℹ this is a pr", repository.owner.login,
      repository.name,
      payload.number)
    //load pr files
    const thisPR = await octokit.rest.pulls.listFiles({
      owner: org,
      repo: repo,
      pull_number: pull_number
    });
    const files = thisPR.data

    //iterating over changed files

    for (const file of files) {

      filename = file.filename

      // create or delete can not be merged automatically
      if (file.status != "modified") {
        setResult(filename, false, "file is new or deleted")
        continue
      }

      //only allowing yaml/yml files
      if (filename.endsWith(".yaml") || filename.endsWith(".yml"))
        console.log("ℹ file is a yml/yaml")
      else {
        setResult(filename, false, "file is not a yaml")
        continue
      }

      //check for noCheckFiles (whitelist)

      //ignore the first x folders in the path - like project name that could change
      //techdebt - make it smarter
      simplePath = filename
      for (let i = 0; i < 2; i++) {
        simplePath = simplePath.substring(simplePath.indexOf('/') + 1)
      }

      if (options.noCheckFiles.includes(simplePath)) {
        setResult(filename, true, "part of noCheckFiles")
        continue
      }


      // compare content of yaml files

      //get master
      contentRequest = { owner: org, repo: repo, path: filename }
      jsonOld = await getContent(contentRequest, octokit)

      //get current
      contentRequest = { owner: org, repo: repo, path: filename, ref: payload.pull_request.head.ref }
      jsonNew = await getContent(contentRequest, octokit)

      //check if both have valid content
      if (jsonOld == null || jsonNew == null) {
        setResult(filename, false, "could not read file content")
      }

      // run the compare
      var delta = diffPatcher.diff(jsonOld, jsonNew);
      console.log("ℹ delta", delta)
      //console.log(jsonDiffPatch.formatters.console.format(delta))


      result = validateDiff(delta, simplePath)
      setResult(filename, result.result, result.msg)

    }

    printSummery()
    if (summery.size != filesChanged) {
      throw `Some files could not be classified, should be ${filesChanged} / was ${summery.size}`
    }

    console.log("All files could be classified ✔")
    //check if map contains "false" elements
    falseMap = new Map([...summery].filter(([k, v]) => v.result == false))
    if (falseMap.size > 0) {
      throw "PR contains changes that are not whitelisted"

    }

    console.log("all files seem to be valid and can be merged")




  } catch (error) {
    console.log("pipeline failed", error)
    core.setFailed(error.message);
  }
}

run();
