# World Problems Blog

Minimal, Vercel-friendly multilingual blog built with Next.js App Router.

## How it works

1. The nightly workflow fetches real questions from Reddit via the JSON API.
2. Candidates are filtered for safety (no NSFW, politics flamewars, or personal identifying info).
3. The generator uses OpenAI to produce a long-form, SEO-optimized post per locale.
4. Markdown files are written to `content/posts/{en,es,fr,de,ja}/` and a PR is opened.

## Required secret

Set `OPENAI_API_KEY` in **GitHub repo Settings → Secrets and variables → Actions**. The generator will exit early if it is missing.

## Running locally

```bash
npm ci
OPENAI_API_KEY=your-key npm run world:run
```

## Verification (local & CI)

After running the generator, confirm new content was created in `content/posts/{lang}/`:

```bash
git status --porcelain content/posts
ls -R content/posts | head -n 50
```

If no files were created, the generator logs the rejection reasons and exits non-zero in CI.
When Reddit input is empty or fully filtered, the workflow generates a short “pipeline status”
heartbeat post to ensure a diff is produced.

Optional environment variables:

- `WORLD_LOCALES=en,es,fr,de,ja` (defaults to all locales)
- `WORLD_MAX_POSTS_PER_LOCALE=2` (default 2)
- `OPENAI_MODEL=gpt-4o-mini` (default)
- `OPENAI_MAX_TOKENS=1800`

## Changing subreddit lists

Edit `scripts/sources/redditConfig.js` to adjust subreddits per locale. Locales with limited sources fall back to English-friendly subreddits.

## How many posts per day

By default, the nightly workflow creates **2 posts per locale**, so up to 10 posts total. Adjust with `WORLD_MAX_POSTS_PER_LOCALE`.

## Cost control

- Lower `WORLD_MAX_POSTS_PER_LOCALE` to generate fewer posts.
- Use a cheaper model via `OPENAI_MODEL`.
- Reduce `OPENAI_MAX_TOKENS` to cap completion size.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run new:post -- --lang <lang> --slug <slug>`
- `npm run world:run`

## Content

Markdown posts live in `content/posts/{lang}/*.md` with frontmatter fields:
- title
- description
- date
- tags
- source_url
- source_subreddit
- cta_primary_label
- cta_primary_url
