// MCPB booleans interpolate as strings; the engine deliberately accepts only 1.
process.env.RA_LIVE = ['true', '1'].includes(process.env.RA_LIVE) ? '1' : '0'
// Never inherit a remote backend or remote signing authority from the host shell.
delete process.env.RA_BACKEND_URL
delete process.env.XRPL_CALLER_SEED
await import('./server.ts')
