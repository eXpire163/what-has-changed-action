const github = require('@actions/github');
const core = require('@actions/core');
const wait = require('./wait');


options = { "noCheckFiles": ["data/namespace.yml"] }


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

        console.log("old", contentOld)
        console.log("new", contentNew)



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
