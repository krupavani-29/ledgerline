const app = require('./app');
const config = require('./config');
const { store } = require('./db/store');
const { seedDatabase } = require('./db/seed');

async function startServer() {
  // If store is empty, auto-seed with initial demo data
  if (store.getUsers().length === 0) {
    console.log('No users found in store. Auto-seeding initial database...');
    await seedDatabase(store);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`=======================================================`);
    console.log(` LedgerLine Financial Engine is RUNNING on port ${config.PORT}`);
    console.log(` Local URL: http://localhost:${config.PORT}`);
    console.log(` Health Check: http://localhost:${config.PORT}/api/health`);
    console.log(` Environment: ${config.NODE_ENV}`);
    console.log(`=======================================================`);
    console.log(` Demo Accounts available:`);
    console.log(`  - Admin:   username: "admin"   / password: "Password@123"`);
    console.log(`  - Auditor: username: "auditor" / password: "Password@123"`);
    console.log(`  - Alice:   username: "alice"   / password: "Password@123"`);
    console.log(`  - Bob:     username: "bob"     / password: "Password@123"`);
    console.log(`  - Charlie: username: "charlie" / password: "Password@123"`);
    console.log(`=======================================================`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nGracefully shutting down LedgerLine...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Fatal Server Boot Error:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
