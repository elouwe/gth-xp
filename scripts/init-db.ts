// scripts/init-db.ts
// ══════════════════════ IMPORTS ══════════════════════
import { DataSource } from "typeorm";
import { User } from '../src/entities/User';
import { Transaction } from '../src/entities/Transaction'; 

// ══════════════════════ ERROR HANDLER ══════════════════════
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else {
    return 'Unknown error occurred';
  }
}

// ══════════════════════ DATABASE SETUP ══════════════════════
async function initializeDB() {
  console.log('\n═════════════════════ ADMIN DATABASE SETUP ═════════════════════');
  
  // ─────────────────── ADMIN CONNECTION ────────────────────
  console.log('✦ Initializing admin connection...');
  const adminDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "alinaakura", 
    password: "",           
    database: "postgres",
    logging: false,
  });

  try {
    await adminDataSource.initialize();
    console.log('✅ Admin connection established');
    
    // ─────────────── USER CREATION ────────────────────────
    console.log('\n─────── USER CREATION ───────');
    try {
      await adminDataSource.query(`
        CREATE USER ton_user WITH 
          PASSWORD 'SEGMYH8yOd1n'
          CREATEDB;
      `);
      console.log('✅ Created database user: ton_user');
    } catch (error) {
      if (getErrorMessage(error).includes('already exists')) {
        console.log('✓ User "ton_user" already exists');
      } else {
        console.error('❌ User creation failed:', getErrorMessage(error));
      }
    }

    // ─────────────── DATABASE CREATION ────────────────────
    console.log('\n─────── DATABASE CREATION ───────');
    try {
      await adminDataSource.query(`
        CREATE DATABASE ton_xp_db
          WITH 
          OWNER = ton_user
          ENCODING = 'UTF8'
          LC_COLLATE = 'C'
          LC_CTYPE = 'C'
          TEMPLATE template0;
      `);
      console.log('✅ Created database: ton_xp_db');
    } catch (error) {
      if (getErrorMessage(error).includes('already exists')) {
        console.log('✓ Database "ton_xp_db" already exists');
      } else {
        console.error('❌ Database creation failed:', getErrorMessage(error));
      }
    }

    // ─────────────── PERMISSION SETUP ─────────────────────
    console.log('\n─────── PERMISSION CONFIG ───────');
    try {
      await adminDataSource.query(`
        GRANT ALL PRIVILEGES ON DATABASE ton_xp_db TO ton_user;
      `);
      console.log('✅ Permissions granted to ton_user');
    } catch (error) {
      console.error('❌ Permission setup failed:', getErrorMessage(error));
    }
    
  } catch (error) {
    console.error('\n❌ ADMIN SETUP ERROR:');
    console.error('✦ Message:', getErrorMessage(error));
    console.error('✦ Action: Verify PostgreSQL superuser credentials');
    
    // ─────────────── FALLBACK MECHANISM ───────────────────
    console.log('\n─────── FALLBACK PROCEDURE ───────');
    try {
      const fallbackDataSource = new DataSource({
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: "SEGMYH8yOd1n",
        database: "postgres",
        logging: false,
      });
      
      await fallbackDataSource.initialize();
      console.log('✅ Fallback connection established');
      
      try {
        await fallbackDataSource.query(`
          CREATE DATABASE IF NOT EXISTS ton_xp_db;
        `);
        console.log('✓ Database verified/created');
      } catch (dbError) {
        console.error('❌ Fallback database creation failed:', getErrorMessage(dbError));
      }
    } catch (fallbackError) {
      console.error('❌ Fallback connection failed:', getErrorMessage(fallbackError));
    }
  } finally {
    if (adminDataSource.isInitialized) {
      await adminDataSource.destroy();
      console.log('✦ Admin connection closed');
    }
  }

  // ─────────────────── USER DATABASE ───────────────────────
  console.log('\n═════════════════════ USER DATABASE SETUP ═════════════════════');
  console.log('✦ Initializing user connection...');
  
  const userDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "ton_user",
    password: "SEGMYH8yOd1n",
    database: "ton_xp_db",
    entities: [User, Transaction],
    synchronize: false, // Disable auto-sync
    logging: true,
  });

  try {
    await userDataSource.initialize();
    console.log('✅ User connection established');
    
    // ─────────────── DATABASE RESET ────────────────────────
    console.log('\n─────── DATABASE RESET ───────');
    try {
      // Reset entire database schema
      await userDataSource.dropDatabase();
      console.log('✓ Dropped existing tables');
      
      await userDataSource.synchronize();
      console.log('✅ Recreated database schema');
    } catch (resetError) {
      console.error('❌ Database reset failed:', getErrorMessage(resetError));
    }
    
    // ─────────────── DATA ACCESS TEST ──────────────────────
    console.log('\n─────── DATA ACCESS TEST ───────');
    try {
      const userRepository = userDataSource.getRepository(User);
      const user = new User();
      user.address = "test_address";
      user.xp = 100;
      await userRepository.save(user);
      
      const savedUser = await userRepository.findOneBy({ address: "test_address" });
      if (savedUser) {
        console.log(`✅ Database operational | Test user XP: ${savedUser.xp}`);
      } else {
        console.error('❌ Data access test failed: User not found');
      }
    } catch (dataError) {
      console.error('❌ Data access test failed:', getErrorMessage(dataError));
    }
    
  } catch (error) {
    console.error('\n❌ USER SETUP ERROR:');
    console.error('✦ Message:', getErrorMessage(error));
    console.error('✦ Action: Check ton_user credentials and database permissions');
  } finally {
    if (userDataSource.isInitialized) {
      await userDataSource.destroy();
      console.log('✦ User connection closed');
    }
  }
  
  console.log('\n═════════════════════ SETUP COMPLETE ═════════════════════');
  console.log('✦ Database configuration finalized');
  console.log('✦ Timestamp:', new Date().toISOString());
}

// ══════════════════════ EXECUTION ══════════════════════
initializeDB().catch((error) => {
  console.error('\n═════════════════════ UNHANDLED ERROR ═════════════════════');
  console.error('❌ CRITICAL FAILURE:');
  console.error('✦ Message:', getErrorMessage(error));
  console.error('✦ Action: Review database configuration and network settings');
  process.exit(1);
});
// ══════════════════════ END ════════════════════