import { ENV, liveReplayEnvironment } from '../shared/presentation'

/** Writer provenance stays on the source badges, including in a replay. */
export const replayLabel = (scenario: string, date: string, testnet: boolean) => scenario === 'UC-real-content'
  ? liveReplayEnvironment.full(date)
  : ENV.replay(date, testnet)

export const replayShortLabel = (scenario: string, testnet: boolean) => scenario === 'UC-real-content'
  ? liveReplayEnvironment.short
  : ENV.replayShort(testnet)
