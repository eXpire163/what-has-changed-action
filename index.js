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

      org = payload.repository.owner.login
      repo = payload.repository.name
      pull_number = payload.number

      console.log("this is a pr", payload.repository.owner.login,
        payload.repository.name,
        payload.number)

      const thisPR = await octokit.rest.pulls.listFiles({
        owner: org,
        repo: repo,
        pull_number: pull_number
      });

      const files = thisPR.data
      files.forEach(file => {
        console.log("found file", file.filename)
        if (file.status != "modified") return
        console.log("is modified", file.status)
        if (file.filename.endsWith(".yaml") || file.filename.endsWith(".yml"))
          console.log("file is a yml/yaml")
        else return

        //console.log("file", file)


        //get master
        var resultOld = octokit.rest.repos.getContent({ owner: org, repo: repo, path: file.filename });
        context.log.debug("oldFileResult: " + resultOld)
        if (!resultOld) {
          context.log.error("old result was empty")
          return;
        }
        const contentOld = Buffer.from(resultOld.data.content, 'base64').toString();

        //get current
        var resultOld = octokit.rest.repos.getContent({ owner: org, repo: repo, path: file.filename, ref: payload.pull_request.ref });
        context.log.debug("newFileResult: " + resultOld)
        if (!resultOld) {
          context.log.error("new result was empty")
          return;
        }
        const contentNew = Buffer.from(resultOld.data.content, 'base64').toString();





      });
    }

  } catch (error) {
    console.log("pipeline failed", error)
    core.setFailed(error.message);
  }
}

run();
