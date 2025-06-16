#!/usr/bin/env node

/**
 * End-to-end database test script
 */

import { initializeDatabase } from './packages/core/dist/core/database.js';

async function testDatabase() {
  console.log('🔍 Testing database operations...');
  
  try {
    // Initialize database
    console.log('📊 Initializing database...');
    const db = await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Test creating a coding instance
    console.log('📝 Creating coding agent instance...');
    const codingInstanceId = `test-coding-${Date.now()}`;
    await db.createInstance({
      id: codingInstanceId,
      type: 'coding',
      status: 'started',
      worktree_path: '/tmp/test-worktree',
      branch_name: 'test-branch',
      tmux_session: 'test-session',
      issue_number: 123,
      base_branch: 'main',
      agent_number: 1,
    });
    console.log(`✅ Created coding instance: ${codingInstanceId}`);

    // Test creating a review instance
    console.log('📝 Creating review agent instance...');
    const reviewInstanceId = `test-review-${Date.now()}`;
    await db.createInstance({
      id: reviewInstanceId,
      type: 'review',
      status: 'started',
      worktree_path: '/tmp/test-review-worktree',
      branch_name: 'review-branch',
      tmux_session: 'review-session',
      base_branch: 'test-branch',
      parent_instance_id: codingInstanceId,
      agent_number: 1,
    });
    console.log(`✅ Created review instance: ${reviewInstanceId}`);

    // Test creating relationship
    console.log('🔗 Creating instance relationship...');
    await db.createRelationship({
      parent_instance: codingInstanceId,
      child_instance: reviewInstanceId,
      relationship_type: 'spawned_review',
      review_iteration: 1,
      metadata: JSON.stringify({
        test: 'data',
        created: new Date().toISOString(),
      }),
    });
    console.log('✅ Created relationship');

    // Test retrieving instances
    console.log('🔍 Retrieving instances...');
    const codingInstance = await db.getInstance(codingInstanceId);
    const reviewInstance = await db.getInstance(reviewInstanceId);
    
    console.log('📋 Coding instance:', {
      id: codingInstance.id,
      type: codingInstance.type,
      status: codingInstance.status,
      branch_name: codingInstance.branch_name,
    });
    
    console.log('📋 Review instance:', {
      id: reviewInstance.id,
      type: reviewInstance.type,
      status: reviewInstance.status,
      parent_instance_id: reviewInstance.parent_instance_id,
    });

    // Test getting relationships
    console.log('🔗 Retrieving relationships...');
    const relationships = await db.getRelationships(codingInstanceId);
    console.log(`📋 Found ${relationships.length} relationships`);
    
    if (relationships.length > 0) {
      const rel = relationships[0];
      console.log('📋 Relationship:', {
        parent: rel.parent_instance,
        child: rel.child_instance,
        type: rel.relationship_type,
        metadata: rel.metadata,
      });
    }

    // Test updating instance
    console.log('📝 Updating review instance with saveReview data...');
    await db.updateInstance(reviewInstanceId, {
      status: 'terminated',
      last_activity: new Date(),
      terminated_at: new Date(),
    });
    
    // Test updating relationship with review data
    await db.updateRelationship(relationships[0].id, {
      metadata: JSON.stringify({
        review: 'This code looks good! Nice implementation.',
        decision: 'approve',
        completedAt: new Date().toISOString(),
      }),
    });
    console.log('✅ Updated instances with review data');

    // Test final state
    console.log('🔍 Final verification...');
    const updatedReview = await db.getInstance(reviewInstanceId);
    const updatedRelationships = await db.getRelationships(codingInstanceId);
    
    console.log('📋 Updated review status:', updatedReview.status);
    console.log('📋 Updated relationship metadata:', updatedRelationships[0].metadata);
    
    // Cleanup
    console.log('🧹 Database test completed successfully!');
    console.log('💾 Database file: packages/core/claude-codex.db');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();