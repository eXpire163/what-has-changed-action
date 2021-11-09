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

    //console.log(context)

    if (context.eventName == "pull_request") {

     console.log(context.owner)

      const thisPR = await octokit.rest.pulls.listFiles({
        owner: context.owner.name,
        repo: context.repository,
        pull_number: context.number
      });

    }

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
