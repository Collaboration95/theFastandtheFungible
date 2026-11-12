export function installLinks(url: string) {
  const config = { name: 'researchagent', type: 'http', url }
  const cursorConfig = btoa(JSON.stringify({ url }))
  const quoted = "'" + url.replaceAll("'", "'\\''") + "'"
  return {
    cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=researchagent&config=${encodeURIComponent(cursorConfig)}`,
    vscode: `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`,
    claude: `claude mcp add --transport http researchagent ${quoted}`,
  }
}
