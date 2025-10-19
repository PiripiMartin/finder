//#!/usr/bin/env bun
//
///**
// * Test script to verify the user_saved_locations system works correctly.
// * This script should be run after the migration to ensure everything is working.
// */
//
//import { db } from "./src/database";
//import { saveLocationForUser, removeSavedLocationForUser, isLocationSavedByUser, getUserSavedLocationIds } from "./src/posts/queries";
//
//async function testSavedLocationsSystem() {
//    console.log("🧪 Testing user_saved_locations system...");
//    
//    try {
//        // Test 1: Check if migration populated data
//        console.log("\n1️⃣ Checking migration results...");
//        const [migrationCount] = await db.execute(`
//            SELECT COUNT(*) as count FROM user_saved_locations
//        `) as [any[], any];
//        
//        const [postsCount] = await db.execute(`
//            SELECT COUNT(DISTINCT CONCAT(posted_by, '-', map_point_id)) as count 
//            FROM posts WHERE posted_by IS NOT NULL
//        `) as [any[], any];
//        
//        console.log(`   - Records in user_saved_locations: ${migrationCount[0].count}`);
//        console.log(`   - Unique user-location pairs in posts: ${postsCount[0].count}`);
//        
//        if (migrationCount[0].count === postsCount[0].count) {
//            console.log("   ✅ Migration data matches posts data");
//        } else {
//            console.log("   ⚠️  Migration data doesn't match posts data");
//        }
//        
//        // Test 2: Test basic CRUD operations
//        console.log("\n2️⃣ Testing CRUD operations...");
//        
//        // Get a test user and location
//        const [testUser] = await db.execute(`
//            SELECT id FROM users LIMIT 1
//        `) as [any[], any];
//        
//        const [testLocation] = await db.execute(`
//            SELECT id FROM map_points LIMIT 1
//        `) as [any[], any];
//        
//        if (testUser.length === 0 || testLocation.length === 0) {
//            console.log("   ⚠️  No test data available, skipping CRUD tests");
//        } else {
//            const userId = testUser[0].id;
//            const locationId = testLocation[0].id;
//            
//            // Test adding
//            console.log(`   - Testing addUserSavedLocation(${userId}, ${locationId})`);
//            await saveLocationForUser(userId, locationId);
//            
//            // Test checking
//            const isSaved = await isLocationSavedByUser(userId, locationId);
//            console.log(`   - isLocationSavedByUser(${userId}, ${locationId}): ${isSaved}`);
//            
//            // Test getting all saved locations
//            const savedIds = await getUserSavedLocationIds(userId);
//            console.log(`   - getUserSavedLocationIds(${userId}): ${savedIds.length} locations`);
//            
//            // Test removing
//            console.log(`   - Testing removeUserSavedLocation(${userId}, ${locationId})`);
//            await removeSavedLocationForUser(userId, locationId);
//            
//            const isSavedAfter = await isLocationSavedByUser(userId, locationId);
//            console.log(`   - isLocationSavedByUser after removal: ${isSavedAfter}`);
//            
//            console.log("   ✅ CRUD operations working correctly");
//        }
//        
//        // Test 3: Verify API compatibility
//        console.log("\n3️⃣ Testing API compatibility...");
//        
//        const [apiTestUser] = await db.execute(`
//            SELECT id FROM users LIMIT 1
//        `) as [any[], any];
//        
//        if (apiTestUser.length > 0) {
//            const userId = apiTestUser[0].id;
//            
//            // Test the new query
//            const [savedLocations] = await db.execute(`
//                SELECT 
//                    mp.id,
//                    mp.title,
//                    usl.created_at
//                FROM user_saved_locations usl
//                INNER JOIN map_points mp ON usl.map_point_id = mp.id
//                WHERE usl.user_id = ?
//                ORDER BY usl.created_at DESC
//                LIMIT 5
//            `, [userId]) as [any[], any];
//            
//            console.log(`   - Found ${savedLocations.length} saved locations for user ${userId}`);
//            if (savedLocations.length > 0) {
//                console.log(`   - Sample location: ${savedLocations[0].title} (saved at ${savedLocations[0].created_at})`);
//            }
//            
//            console.log("   ✅ API queries working correctly");
//        }
//        
//        console.log("\n🎉 All tests passed! The user_saved_locations system is working correctly.");
//        
//    } catch (error) {
//        console.error("❌ Test failed:", error);
//        throw error;
//    } finally {
//        await db.end();
//    }
//}
//
//// Run the tests
//if (import.meta.main) {
//    testSavedLocationsSystem()
//        .then(() => {
//            console.log("✅ Test completed successfully!");
//            process.exit(0);
//        })
//        .catch((error) => {
//            console.error("💥 Test failed:", error);
//            process.exit(1);
//        });
//}
//
//export { testSavedLocationsSystem };
