# Publish

Only after every precondition holds.

1. Write title and body to temporary files outside the repository.
2. Read the open pull request: `gh pr list --repo <repo> --head <branch> --state open --json number,body,baseRefName,isDraft,isCrossRepository --jq 'map(select(.isCrossRepository | not))'`. The filter drops pull requests from forks, which are never yours to edit. One for another base: report it and stop. Failing tests and one that is not a draft: stop.
3. `git push --no-follow-tags --recurse-submodules=check -u origin refs/heads/<branch>:refs/heads/<branch>`, exactly as written, so git config cannot change the destination, force it or add refs. Rejected or failed: report it and stop; no pull, rebase, merge or pull request change.
4. Create or update:
   * An open one: `gh pr edit <number> --repo <repo> --body-file <body-file>`, keeping what people added to its body. Keep its title; add `--title "$(cat <title-file>)"` only if the user asks.
   * None: `gh pr create --repo <repo> --base <base> --head <branch> --title "$(cat <title-file>)" --body-file <body-file>`, plus `--draft` when the user asked for a draft.
5. Report the URL.

The pull request lives in the repository of `origin`. One from a fork into another repository is out of scope: say so.
