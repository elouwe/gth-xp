import { DataSource } from "typeorm";
import { User } from '../src/entities/User';
import { Transaction } from '../src/entities/Transaction'; 

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else {
    return 'Unknown error occurred';
  }
}

async function initializeDB() {
  console.log('\n═════════ ADMIN DATABASE SETUP ═════════');
  console.log('✦ Connecting as superuser...');
  
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

    console.log('✦ Creating user "ton_user"...');
    try {
      await adminDataSource.query(`
        CREATE USER ton_user WITH 
          PASSWORD 'SEGMYH8yOd1n'
          CREATEDB;
      `);
      console.log('✅ User "ton_user" created');
    } catch (error) {
      console.log('✓ User "ton_user" already exists. Skipping creation.');
    }

    console.log('✦ Creating database "ton_xp_db"...');
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
      console.log('✅ Database created: ton_xp_db');
    } catch (error) {
      if (getErrorMessage(error).includes('already exists')) {
        console.log('✓ Database "ton_xp_db" already exists. Skipping creation.');
      } else {
        throw error;
      }
    }

    console.log('✦ Configuring permissions...');
    await adminDataSource.query(`
      GRANT ALL PRIVILEGES ON DATABASE ton_xp_db TO ton_user;
    `);
    console.log('✅ Permissions granted to ton_user');
    
  } catch (error) {
    console.error('\n❌ ADMIN SETUP ERROR:');
    console.error('✦ Message:', getErrorMessage(error));
    console.error('✦ Action: Verify PostgreSQL superuser credentials');
    
    console.log('\n✦ Trying fallback connection...');
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
      console.log('✅ Fallback connection successful');
      
      await fallbackDataSource.query(`
        CREATE DATABASE IF NOT EXISTS ton_xp_db
          WITH 
          OWNER = ton_user
          ENCODING = 'UTF8'
          LC_COLLATE = 'C'
          LC_CTYPE = 'C'
          TEMPLATE template0;
      `);
      
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', getErrorMessage(fallbackError));
    }
  } finally {
    if (adminDataSource.isInitialized) {
      await adminDataSource.destroy();
      console.log('✦ Admin connection closed');
    }
  }

  console.log('\n═════════ USER DATABASE SETUP ═════════');
  console.log('✦ Connecting as ton_user...');
  
  const userDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "ton_user",
    password: "SEGMYH8yOd1n",
    database: "ton_xp_db",
    entities: [User, Transaction], // Добавлена сущность
    synchronize: true,
    logging: false,
  });

  try {
    await userDataSource.initialize();
    console.log('✅ User connection established');

    console.log('✦ Checking users table...');
    const tableExistsResult = await userDataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = 'users' // FIXED: 'user' → 'users'
      )
    `);
    
    const tableExists = tableExistsResult[0]?.exists;
    if (!tableExists) {
      console.log('✦ Creating users table...');
      await userDataSource.synchronize();
      console.log('✅ Users table created');
    } else {
      console.log('✓ Users table already exists');
    }
    
    console.log('✦ Verifying data access...');
    const userRepository = userDataSource.getRepository(User);
    const userCount = await userRepository.count();
    console.log(`✅ Database operational. Users count: ${userCount}`);
    
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
}

initializeDB().catch((error) => {
  console.error('\n═════════ UNHANDLED ERROR ═════════');
  console.error('❌ CRITICAL FAILURE:');
  console.error('✦ Message:', getErrorMessage(error));
  console.error('✦ Action: Review database configuration and network settings');
  process.exit(1);
});