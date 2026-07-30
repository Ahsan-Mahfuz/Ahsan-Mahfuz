/**
 * Refreshes tools/data.json from the GitHub GraphQL API.
 *
 * The counters and "updated N days ago" chips in the generated cards are baked
 * into SVGs, so something has to keep them honest — that is this script plus
 * .github/workflows/refresh-assets.yml, which runs it twice a day and rebuilds.
 *
 * Which repositories get refreshed is taken from the existing `repos` keys in
 * data.json, so adding a project card means adding its primary repo there.
 *
 * Usage: GITHUB_TOKEN=<token> node fetch-data.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = resolve(HERE, 'data.json')
const USER = process.env.PROFILE_USER ?? 'Ahsan-Mahfuz'
const TOKEN = process.env.GITHUB_TOKEN

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required (the workflow passes the built-in token).')
  process.exit(1)
}

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const repoNames = Object.keys(data.repos)

const repoQueries = repoNames
  .map(
    (name, i) => `
    r${i}: repository(owner: "${USER}", name: "${name}") {
      pushedAt
      primaryLanguage { name }
    }`,
  )
  .join('')

const query = `query {
  user(login: "${USER}") {
    createdAt
    followers { totalCount }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER, isFork: false) { totalCount }
    contributionsCollection {
      contributionCalendar { totalContributions }
    }
  }
  ${repoQueries}
}`

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': `${USER}-profile-assets`,
  },
  body: JSON.stringify({ query }),
})

if (!res.ok) {
  console.error(`GitHub API returned ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const body = await res.json()
if (body.errors) {
  console.error('GraphQL errors:', JSON.stringify(body.errors, null, 2))
  process.exit(1)
}

const user = body.data.user
const next = {
  generatedAt: new Date().toISOString().slice(0, 10),
  stats: {
    repos: user.repositories.totalCount,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    followers: user.followers.totalCount,
    since: new Date(user.createdAt).getFullYear(),
  },
  repos: Object.fromEntries(
    repoNames.map((name, i) => {
      const repo = body.data[`r${i}`]
      // A renamed or deleted repo comes back null — keep the last known values
      // rather than writing "undefined" into a card.
      if (!repo) {
        console.warn(`! ${name} not found, keeping previous values`)
        return [name, data.repos[name]]
      }
      return [
        name,
        {
          language: repo.primaryLanguage?.name ?? data.repos[name].language,
          lastPush: repo.pushedAt.slice(0, 10),
        },
      ]
    }),
  ),
}

writeFileSync(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`)
console.log(
  `✓ ${next.stats.repos} repos · ${next.stats.contributions} contributions · ` +
    `${next.stats.followers} followers · since ${next.stats.since}`,
)
