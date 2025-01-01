import { Octokit } from "@octokit/rest";

async function getCommits() {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setDate(today.getDate() - 1);
  today.setHours(23, 59, 59, 999);

  // Get user's repositories
  const { data: repos } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: "updated",
  });

  console.log("repos", { repos: repos.map((repo) => repo.name) });

  let allCommits = [];

  for (const repo of repos) {
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner: repo.owner.login,
        repo: repo.name,
        author: process.env.GITHUB_ACTOR,
        since: yesterday.toISOString(),
        until: new Date().toISOString(),
        per_page: 100,
      });

      console.log("commits", { commits, repo: repo.name });

      const repoCommits = commits.map((commit) => ({
        repo: repo.full_name,
        message: commit.commit.message,
        url: commit.html_url,
        timestamp: commit.commit.author.date,
      }));

      allCommits = [...allCommits, ...repoCommits];
    } catch (error) {
      console.error(
        `Error fetching commits for ${repo.full_name}:`,
        error.message,
      );
    }
  }

  // Sort commits by timestamp
  allCommits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  console.log("allCommits", { allCommits });

  // Generate markdown
  let markdown = `# Commit Log for ${process.env.LOG_DATE}\n\n`;

  if (allCommits.length === 0) {
    markdown += "📭 No commits found for this day.\n";
  } else {
    markdown += `📝 Total Commits: ${allCommits.length}\n\n`;

    // Group commits by repository
    const commitsByRepo = allCommits.reduce((acc, commit) => {
      if (!acc[commit.repo]) {
        acc[commit.repo] = [];
      }
      acc[commit.repo].push(commit);
      return acc;
    }, {});

    // Generate markdown for each repository
    for (const [repo, commits] of Object.entries(commitsByRepo)) {
      markdown += `## 📁 ${repo}\n\n`;
      commits.forEach((commit) => {
        const time = new Date(commit.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        markdown += `- \`${time}\` [${commit.message.split("\n")[0]}](${commit.url})\n`;
      });
      markdown += "\n";
    }
  }

  console.log(markdown);
}

getCommits().catch(console.error);
