import links from './links.json'
/** Public entry point shared by replay and app metadata. */
export const HOSTED_APP_URL = links.hostedApp
export const REPO_URL = links.repo
/** The release the hosted home tells builders to install. It is always one that is already PUBLISHED: bump `release` and
 * `publishedReleases` together, in the change that follows `gh release view <tag>` succeeding, never before. */
export const RELEASE_TAG = links.release
export const PUBLISHED_RELEASES: readonly string[] = links.publishedReleases
/** A public proof of refusal anyone may open without asking a question; empty until one is published on the final build. */
export const EXAMPLE_PROOF_URL = links.exampleProof
export const isPublishedRelease = (tag: string) => PUBLISHED_RELEASES.includes(tag)
export const releaseBase = (tag = RELEASE_TAG) => `${REPO_URL}/releases/download/${tag}`
