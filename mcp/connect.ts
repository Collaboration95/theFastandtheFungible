import type { Config } from '../server/config.js'
export function connectionDetails(config: Config) {
  const url = config.MCP_CONNECT_URL || (config.HOSTED === '1' && config.MCP_PUBLIC === 'on' ? new URL('/mcp', config.HOSTED_ORIGIN).href : null)
  if (!url) return { url: null }
  const target = new URL(url)
  if (target.username || target.password || target.search || target.hash || (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(target.hostname)))) return { url: null }
  return { url: target.href, requiresBearer: config.HOSTED !== '1' }
}
