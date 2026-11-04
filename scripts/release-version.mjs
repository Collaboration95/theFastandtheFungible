// Python distributions use PEP 440; npm tarballs retain SemVer spelling.
export function pythonVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/.test(version)) throw Error(`Unsupported Python release version: ${version}`)
  return version.replace(/-rc\.(\d+)$/, 'rc$1')
}
