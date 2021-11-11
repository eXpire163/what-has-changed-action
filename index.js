const github = require('@actions/github');
const core = require('@actions/core');
const wait = require('./wait');
const YAML = require('yaml')


options = { "noCheckFiles": ["subber/namespace.yml"] }
var jsonDiffPatch = require('jsondiffpatch')


// most @actions toolkit packages have async methods
async function run() {
  try {

    console.log("hi there");

    const myToken = core.getInput('myToken');

    const octokit = github.getOctokit(myToken)

    const context = github.context;

    const payload = context.payload

   // console.log(context)


    if (context.eventName == "pull_request") {

      org = payload.repository.owner.login
      repo = payload.repository.name
      pull_number = payload.number
      filesChanged = payload.pull_request.changed_files

      console.log("this is a pr", payload.repository.owner.login,
        payload.repository.name,
        payload.number)

      const thisPR = await octokit.rest.pulls.listFiles({
        owner: org,
        repo: repo,
        pull_number: pull_number
      });

      const files = thisPR.data

      //iterating over changed files
      summery = new Map();
      for (const file of files) {



        console.log("found file", file.filename)
        if (file.status != "modified") {
          summery.set(file.filename,  { "result": false, "reason": "file is new or deleted" })
          continue
        }
        //console.log("is modified", file.status)
        if (file.filename.endsWith(".yaml") || file.filename.endsWith(".yml"))
          console.log("file is a yml/yaml")
        else {
          summery.set(file.filename,  { "result": false, "reason": "file is not a yaml" })
          continue
        }

        //console.log("file", file)

        //check for noCheckFiles
          //ignore the first x folders in the path
          //techdebt - make it smarter
          simplePath = file.filename
          for (let i = 0; i < 2; i++) {
            simplePath = simplePath.substring(simplePath.indexOf('/') + 1)
          }
          console

        if (options["noCheckFiles"].includes(simplePath)) {
          summery.set(file.filename,  { "result": true, "reason": "part of noCheckFiles" })
          continue
        }


        //get master
        var resultOld = await octokit.rest.repos.getContent({ owner: org, repo: repo, path: file.filename });
        console.log("oldFileResult: " + resultOld)
        if (!resultOld) {
          console.log("old result was empty")
          continue;
        }
        const contentOld = Buffer.from(resultOld.data.content, 'base64').toString();

        //get current
        var resultNew = await octokit.rest.repos.getContent({ owner: org, repo: repo, path: file.filename, ref: payload.pull_request.head.ref });
        console.log("newFileResult: " + resultNew)
        if (!resultNew) {
          console.log("new result was empty")
          continue;
        }
        const contentNew = Buffer.from(resultNew.data.content, 'base64').toString();

        //console.log("old", contentOld)
        //console.log("new", contentNew)

        //compare old to new
        // create a configured instance, match objects by name
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

        jsonOld = JSON.parse(JSON.stringify(YAML.parse(contentOld)))
        jsonNew = JSON.parse(JSON.stringify(YAML.parse(contentNew)))
        console.log(jsonOld, jsonNew)
        var delta = diffPatcher.diff(jsonOld, jsonNew);
        console.log(delta)
        console.log(jsonDiffPatch.formatters.console.format(delta))


      }
      console.log("########### result ##########");
      console.log(summery)
      if (summery.size == filesChanged){
        console.log("All files could be classified")
        //check if map contains "false" elements
        falseMap = summery.filter(([k, v]) => v.result == false)
        if(falseMap.size > 0){
          console.log("cannot allow auto merge")
        }
        else{
          console.log("all files seem to be valid and can be merged")
        }
      }
      else{
        console.log("Some files could not be classified, should be / was", filesChanged, summery.size)
      }
    }

  } catch (error) {
    console.log("pipeline failed", error)
    core.setFailed(error.message);
  }
}

run();
