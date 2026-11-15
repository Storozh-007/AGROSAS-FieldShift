# GitHub

Repository: https://github.com/Storozh-007/AGROSAS-OS

The local main branch tracks origin/main. Push changes with:

```bash
git add .
git commit -m "Describe the change"
git push
```

Authentication on this Mac uses GitHub CLI over HTTPS. SSH was not configured; the repository URL does not contain credentials.

Do not commit `.env`, `.env.local`, `.runtime`, database backups, node_modules or .next. These are ignored. A push transfers source, assets and configuration; it does not transfer the running database or deploy an application automatically.

The old local bootstrap history remains on the local-only `local/pre-github-import` branch because it contained an obsolete demo token. Only the clean main history is published. Do not use `git push --all`.

In Codespaces, open the repository and run `git pull`. With Docker Engine available, use `./fieldshift start`; forward port 8080 through Codespaces. The app remains a local single-organization demo. Do not make a forwarded port public without adding user authentication and reviewing access controls.
