import { runDailyImport } from './smart-daily-import';

console.log('🚀 Running daily import manually...\n');

runDailyImport()
  .then(() => {
    console.log('\n✅ Daily import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Daily import failed:', error);
    process.exit(1);
  });