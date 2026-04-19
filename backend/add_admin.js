const { initFirebase } = require('./config/firebase');
const { registerAdmin } = require('./services/dbService');

async function main() {
  console.log('🚀 Initializing Firebase...');
  const db = initFirebase();
  if (!db) {
    console.error('❌ Failed to initialize Firebase. Check your .env file.');
    process.exit(1);
  }

  console.log('👤 Adding admin: Swapnil');
  try {
    const result = await registerAdmin('Swapnil', '123456');
    if (result.success) {
      console.log('✅ Admin "Swapnil" added successfully!');
      console.log('ID:', result.id);
    } else {
      console.log('❌ Error adding admin:', result.error);
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
  process.exit(0);
}

main();
