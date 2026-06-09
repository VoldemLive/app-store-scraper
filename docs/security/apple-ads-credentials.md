# Apple Ads credential security

Apple Ads integrations require credentials that grant access to advertising
accounts. Never store private keys, OAuth client secrets, access tokens, or
refresh tokens in this repository.

## Local configuration

Store private keys outside the repository and pass their absolute path through
the process environment. Use `.env.example` only as a list of supported
configuration names; it contains placeholders and is safe to commit.

Do not put real credentials in:

- source files, tests, fixtures, examples, issues, or pull requests;
- command output, application logs, screenshots, or recorded test output;
- files under the repository, even when those files are ignored by Git.

The repository ignores common credential file extensions as a last line of
defense. Ignore rules are not a secret store and do not prevent other tools
from reading local files.

## Verification

Run the repository scanner before committing:

```sh
npm run check:secrets
```

CI runs the same current-tree scan and Gitleaks against Git history. Packaging
also runs the current-tree scan before creating an npm artifact. Synthetic test
values verify scanner behavior without storing valid credentials.

## Suspected exposure

If a credential may have been exposed:

1. Revoke or rotate it immediately in the relevant Apple account.
2. Remove it from the working tree and any shared logs or artifacts.
3. Notify repository maintainers without copying the credential.
4. Identify commits and published packages that contain the credential.
5. Use an approved history-rewrite process when tracked history is affected.
6. Force affected users and services to replace old credentials after cleanup.

Deleting a secret in a later commit does not remove it from Git history.
