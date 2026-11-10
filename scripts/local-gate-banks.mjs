// Which judge banks are still held-out for development-only gates (RA_DEV_BANKS_ONLY=1).
//
// A bank is held-out only until it has been measured once. After that its questions and
// results are published development data (v5 was run on 10 Nov 2026), so a development
// lane may read them. Only a bank that is frozen but not yet measured stays blanked.
//
// Bump USED_BANKS_THROUGH in the same change that commits a new bank's measurement.
// Any higher version is treated as unreleased, so a future v6 is protected from the
// moment its file appears, with no other edit.
export const USED_BANKS_THROUGH = 5

const bankVersion = path => {
  const match = /^eval\/questions\/judge-xrpl\.v(\d+)(?:[.-]|$)/.exec(path) ?? /^docs\/evidence\/v(\d+)-heldout\//.exec(path)
  return match ? Number(match[1]) : undefined
}

/** True for the question files and evidence packets of a bank that has not been measured yet. */
export const heldOutBankPath = path => {
  const version = bankVersion(path)
  return version !== undefined && version > USED_BANKS_THROUGH
}

/** True for the frozen-bank schema test (`tests/judge-bank-vN.test.ts`) of an unreleased bank. */
export const heldOutBankTest = path => {
  const match = /^tests\/judge-bank-v(\d+)\.test\.ts$/.exec(path)
  return Boolean(match) && Number(match[1]) > USED_BANKS_THROUGH
}
