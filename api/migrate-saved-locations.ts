#!/usr/bin/env bun

/**
 * Migration script to populate user_saved_locations table from existing posts.
 * This script should be run once to migrate existing data to the new system.
 */

import { db } from "./src/database";

async function migrateSavedLocations() {
    console.log("🔄 Starting migration of saved locations from posts to user_saved_locations table...");
    
    try {
        
        // Get all unique user-location pairs from posts
        console.log("🔍 Finding all user-location pairs from posts...");
        const [rows] = await db.execute(`
            SELECT DISTINCT 
                posted_by as user_id, 
                map_point_id,
                MIN(posted_at) as first_posted_at
            FROM posts 
            WHERE posted_by IS NOT NULL
            GROUP BY posted_by, map_point_id
            ORDER BY first_posted_at ASC
        `) as [any[], any];
        
        console.log(`📊 Found ${rows.length} unique user-location pairs to migrate`);
        
        if (rows.length === 0) {
            console.log("✅ No data to migrate. Migration complete.");
            return;
        }
        
        // Insert into user_saved_locations table
        console.log("💾 Inserting user-location pairs into user_saved_locations table...");
        
        let insertedCount = 0;
        let skippedCount = 0;
        
        for (const row of rows) {
            try {
                // Use INSERT IGNORE to avoid duplicates
                await db.execute(`
                    INSERT IGNORE INTO user_saved_locations (user_id, map_point_id, created_at)
                    VALUES (?, ?, ?)
                `, [row.user_id, row.map_point_id, row.first_posted_at]);
                
                insertedCount++;
            } catch (error) {
                // This might happen if there are foreign key constraints
                console.warn(`⚠️  Skipped user ${row.user_id}, location ${row.map_point_id}: ${error}`);
                skippedCount++;
            }
        }
        
        console.log(`✅ Migration complete!`);
        console.log(`   - Inserted: ${insertedCount} records`);
        console.log(`   - Skipped: ${skippedCount} records`);
        
        // Verify the migration
        console.log("🔍 Verifying migration...");
        const [verifyRows] = await db.execute(`
            SELECT COUNT(*) as count FROM user_saved_locations
        `) as [any[], any];
        
        console.log(`📊 Total records in user_saved_locations: ${verifyRows[0].count}`);
        
    } catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    } finally {
        await db.end();
    }
}

// Run the migration
if (import.meta.main) {
    migrateSavedLocations()
        .then(() => {
            console.log("🎉 Migration completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Migration failed:", error);
            process.exit(1);
        });
}

export { migrateSavedLocations };
