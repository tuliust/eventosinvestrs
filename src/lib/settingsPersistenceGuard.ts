export function settingsPatchMatchesPersisted(
  patch: Record<string, unknown>,
  persisted: Record<string, unknown>,
) {
  return Object.entries(patch).every(
    ([key, value]) => JSON.stringify(persisted[key]) === JSON.stringify(value),
  )
}
