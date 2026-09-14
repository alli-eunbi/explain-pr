# Security

explain-pr reads pull requests and renders local HTML. It should never execute PR code, write outside the output directory, or send data anywhere but the GitHub API you are already authenticated against.

If you find behavior that breaks one of those promises (for example: PR text that makes the agent run a command, a path that escapes the output directory, source contents leaking into error output, or the viewer loading anything remote), please report it privately through GitHub's private vulnerability reporting for this repository rather than a public issue. Include the version or commit, the agent and OS, and a minimal reproduction without real customer data.

Reports against the current `main` and the latest release are handled first; older commits are best effort.
