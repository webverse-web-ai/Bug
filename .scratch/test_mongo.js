const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://DEVAMAN:happycoding7@cluster0.bx7ezd3.mongodb.net/bugapp?appName=Cluster0";

async function run() {
  const client = new MongoClient(uri);

  try {
    console.log("Connecting to MongoDB...");
    await client.connect();
    console.log("✅ Successfully connected to MongoDB.");

    // Ping the cluster
    const db = client.db('admin');
    await db.command({ ping: 1 });
    console.log("✅ Ping successful. Network and credentials are valid.");

    // Try to get connection status/roles
    try {
      const status = await db.command({ connectionStatus: 1, showPrivileges: true });
      const authInfo = status.authInfo;
      console.log("\n🔒 User Authenticated Roles:");
      authInfo.authenticatedUserRoles.forEach(r => console.log(`  - Role: ${r.role} on database: ${r.db}`));
      
      if (authInfo.authenticatedUserPrivileges && authInfo.authenticatedUserPrivileges.length > 0) {
        console.log("\n🔑 User Privileges Sample (first 5):");
        authInfo.authenticatedUserPrivileges.slice(0, 5).forEach(p => {
          console.log(`  - Action: ${p.actions.join(', ')} on resource:`, p.resource);
        });
      } else {
        console.log("\n🔑 User has basic roles, or showPrivileges returned empty.");
      }
    } catch (e) {
      console.log("⚠️ Could not fetch detailed privileges (might need higher admin rights):", e.message);
    }

    // Check read/write on a specific database
    console.log("\n📝 Testing basic read/write access on 'test_db' database...");
    const testDb = client.db('test_db');
    const testCol = testDb.collection('permissions_test');
    
    await testCol.insertOne({ timestamp: new Date(), message: "Connection test successful" });
    console.log("✅ Insert successful (Write permission granted).");
    
    const doc = await testCol.findOne({ message: "Connection test successful" });
    if (doc) {
      console.log("✅ Read successful (Read permission granted).");
    }

    // Clean up
    await testCol.deleteMany({ message: "Connection test successful" });
    console.log("✅ Deletion successful (Delete permission granted).");
    
  } catch (error) {
    console.error("❌ Connection or permission error:", error);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
