const github = require('@actions/github');
const core = require('@actions/core');
const wait = require('./wait');


// most @actions toolkit packages have async methods
async function run() {
  try {

    console.log("hi there");

    const myToken = core.getInput('myToken');

    const octokit = github.getOctokit(myToken)

    const context = github.context;

    const payload = context.payload

    //console.log(context)

    if (context.eventName == "pull_request") {

      console.log("this is a pr", payload.repository.owner.login,
        payload.repository.name,
         payload.number)

      const thisPR = await octokit.rest.pulls.listFiles({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        pull_number: payload.number
      });

      const files = thisPR.data
      files.forEach(file => {

        if(file.status != "modified") return;
        if(!file.filename.endsWith(".yaml") || !file.filename.endsWith(".yml")) return;

        console.log("file", file )
      });
    }

  } catch (error) {
    console.log("pipeline failed", error)
    core.setFailed(error.message);
  }
}

run();
