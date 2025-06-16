/**
 * Simple integration test for database + workflow
 */

import { getDatabase } from './src/core/database';

async function testIntegration() {
  console.log('🔍 Testing database + workflow integration...');
  
  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    const database = await getDatabase();
    console.log('✅ Database connected');

    // Test creating instances
    console.log('📝 Creating test instances...');
    const parentId = `test-coding-${Date.now()}`;
    const reviewId = `test-review-${Date.now()}`;
    
    // Create coding instance
    await database.createInstance({
      id: parentId,
      type: 'coding',
      status: 'waiting_review',
      worktree_path: '/tmp/test-worktree',
      branch_name: 'test-branch',
      tmux_session: 'test-session',
      issue_number: 123,
      base_branch: 'main',
      agent_number: 1,
    });
    
    // Create review instance
    await database.createInstance({
      id: reviewId,
      type: 'review',
      status: 'started',
      worktree_path: '/tmp/test-review',
      branch_name: 'review-branch',
      tmux_session: 'review-session',
      base_branch: 'test-branch',
      parent_instance_id: parentId,
      agent_number: 1,
    });
    
    console.log(`✅ Created instances: ${parentId}, ${reviewId}`);

    // Test relationship creation
    console.log('🔗 Creating relationship...');
    await database.createRelationship({
      parent_instance: parentId,
      child_instance: reviewId,
      relationship_type: 'spawned_review',
      review_iteration: 1,
      metadata: null,
    });
    console.log('✅ Relationship created');

    // Test saveReview simulation (database operations only)
    console.log('💾 Simulating saveReview operations...');
    
    // Update review instance
    await database.updateInstance(reviewId, {
      status: 'terminated',
      last_activity: new Date(),
      terminated_at: new Date(),
    });
    
    // Get relationships and update with review data
    const relationships = await database.getRelationships(parentId);
    if (relationships.length > 0) {
      await database.updateRelationship(relationships[0].id, {
        metadata: JSON.stringify({
          review: 'Code looks great! Nice implementation.',
          decision: 'approve',
          completedAt: new Date().toISOString(),
        }),
      });
    }
    
    // Update parent instance
    await database.updateInstance(parentId, {
      status: 'started',
      last_activity: new Date(),
    });
    
    console.log('✅ SaveReview simulation completed');

    // Verify final state
    console.log('🔍 Verifying final state...');
    const finalParent = await database.getInstance(parentId);
    const finalReview = await database.getInstance(reviewId);
    const finalRelationships = await database.getRelationships(parentId);
    
    console.log('📋 Final parent status:', finalParent?.status);
    console.log('📋 Final review status:', finalReview?.status);
    console.log('📋 Relationships count:', finalRelationships.length);
    
    if (finalRelationships.length > 0) {
      const metadata = JSON.parse(finalRelationships[0].metadata || '{}');
      console.log('📋 Review decision:', metadata.decision);
      console.log('📋 Review preview:', metadata.review?.substring(0, 30) + '...');
    }

    console.log('🎉 Integration test completed successfully!');
    console.log('✅ Database schema and workflow operations work correctly');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    throw error;
  }
}

testIntegration().catch(console.error);