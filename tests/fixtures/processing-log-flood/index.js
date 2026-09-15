// Test fixture: push far more log data than fits in the run document (mongo's
// 16MB limit). Each message is longer than worker.task.maxLogEntryLength so
// the per-entry truncation is exercised too, and so the document fills up in
// a couple thousand entries instead of hundreds of thousands. The worker is
// expected to fail the run before the loop ends.
export const run = async (context) => {
  const { log } = context
  await log.step('starting log-flood fixture')
  const message = 'x'.repeat(20_000)
  for (let i = 0; i < 5000; i++) {
    await log.info(message)
  }
  await log.info('log-flood fixture finished, the guard did not trigger')
}
