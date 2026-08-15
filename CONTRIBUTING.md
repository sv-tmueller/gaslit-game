# Contributing to Pitfall

Thanks for taking an interest in the project. This document covers how work
is organized, the conventions contributions are expected to follow, and how
to report problems or ideas.

## Code of Conduct

By participating in this project, you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md). Report unacceptable behavior as
described there.

## How work is organized

Every unit of work is tracked as a GitHub issue. Issues carry a `size:`
label (for example `size:S`, `size:M`, `size:L`) indicating roughly how
much work they represent.

### Roadmap issues are not ready to implement

Issues labeled `roadmap` are placeholders, not work packages. They capture
an idea or a direction, but they are missing the detail a contributor
needs to actually build the thing: scope, acceptance criteria, non-goals,
and a size estimate. This repository currently has around 50 such
placeholders.

Before picking up a `roadmap` issue, it must be refined into a full work
package that states:

* **Scope**: what is in and out of the change.
* **Acceptance criteria**: how to tell the work is done.
* **Non-goals**: what this issue explicitly does not attempt, to prevent
  scope creep.
* **Size**: a `size:` label reflecting the refined scope.

Do not start implementing a `roadmap` issue as-is. If you want to work on
one, either refine it yourself (and say so on the issue) or ask a
maintainer to refine it first. Implementing an unrefined placeholder is a
common way to end up with a PR that doesn't match what was actually wanted.

## Branches and pull requests

Branch names follow:

* `feat/<issue>-<slug>` for features
* `fix/<issue>-<slug>` for bug fixes

For example, `feat/57-community-health` or `fix/12-score-overflow`.

Pull requests should reference the issue they resolve, using `Closes #N`
in the PR description so GitHub links and closes the issue automatically
on merge.

## Commit style

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, and so on).

Writing style, in commits, PR descriptions, code comments, and docs:

* Plain, direct English.
* No em dashes.
* No AI-cliche phrasing ("leverage", "seamless", "robust solution", and
  similar filler).
* Comments explain non-obvious *why*, not what the code already says.

## Local checks

The project's intended local checks are:

```bash
npm run dev
npm run build
npm test
npm run lint
npm run typecheck
```

The toolchain that provides these scripts lands via issue #1. Until that
lands (and on any branch that predates it), these commands may not exist
yet. Do not assume they run; check `package.json` on your branch, and if a
script is missing, say so in your PR rather than adding it yourself unless
your issue specifically owns that.

## Reporting bugs and proposing ideas

Use GitHub issues for bug reports, level ideas, trap ideas, and anything
else. Use the issue templates where available; they help make sure a
report has the information needed to act on it. If no template fits, open
a blank issue and describe the problem or idea as clearly as you can:
what you expected, what happened instead, and how to reproduce it if it's
a bug.

See the [README](README.md) for what the game is and how to run it.

## Reporting security issues

Do not open a public issue for a security vulnerability. See
[SECURITY.md](SECURITY.md) for how to report one privately.

## Contact

This project doesn't use email for contact. Reach the maintainer,
[@sv-tmueller](https://github.com/sv-tmueller), through GitHub: issues,
pull request comments, or GitHub's private reporting features described
in [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
