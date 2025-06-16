#!/usr/bin/env bun

/**
 * Test workflow integration
 */

import { getDatabase } from './packages/core/src/core/database';
import { ReviewAgentWorkflow } from './packages/workflows/src/workflows/review-agent-workflow';

async function testWorkflow() {
  console.log('🔍 Testing workflow integration...');
  
  try {
    // Get database instance
    console.log('📊 Getting database instance...');
    const database = await getDatabase();
    console.log('✅ Database connected');

    // Create a mock parent coding instance
    console.log('📝 Creating mock coding instance...');
    const parentInstanceId = `test-coding-${Date.now()}`;
    await database.createInstance({
      id: parentInstanceId,
      type: 'coding',
      status: 'waiting_review',
      worktree_path: '/tmp/test-worktree',
      branch_name: 'test-branch',
      tmux_session: 'test-tmux-session',
      issue_number: 123,
      base_branch: 'main',
      agent_number: 1,
    });
    console.log(`✅ Created parent instance: ${parentInstanceId}`);

    // Test ReviewAgentWorkflow.saveReview method
    console.log('🔍 Testing ReviewAgentWorkflow...');
    const reviewWorkflow = new ReviewAgentWorkflow(database);
    
    // Create review config
    const reviewConfig = {
      parentInstanceId: parentInstanceId,
      parentTmuxSession: 'test-tmux-session',
      issueNumber: 123,
      codingDescription: 'Implemented feature X with proper error handling',
      preserveChanges: false,
      timeoutMinutes: 30,
    };

    console.log('🚀 Executing review workflow...');
    const reviewExecution = await reviewWorkflow.execute(reviewConfig);
    console.log(`✅ Review workflow executed, instance: ${reviewExecution.id}`);

    // Test the saveReview method (but skip TMUX injection for test)
    console.log('💾 Testing saveReview method...');
    
    // Mock the TMUX injection to avoid real tmux calls in test
    const originalInjectMethod = (reviewWorkflow as any).injectReviewIntoTmux;
    (reviewWorkflow as any).injectReviewIntoTmux = async () => {
      console.log('🎭 Mocked TMUX injection (would normally inject review into session)');
    };
    
    await reviewWorkflow.saveReview(
      reviewExecution.id,
      'Code looks great! Nice implementation with proper error handling. The architecture is clean and follows best practices.',
      'approve'
    );
    console.log('✅ saveReview completed successfully');

    // Verify the state
    console.log('🔍 Verifying final state...');
    const reviewInstance = await database.getInstance(reviewExecution.id);
    const parentInstance = await database.getInstance(parentInstanceId);
    const relationships = await database.getRelationships(parentInstanceId);

    console.log('📋 Review instance status:', reviewInstance?.status);
    console.log('📋 Parent instance status:', parentInstance?.status);
    console.log('📋 Relationships found:', relationships.length);

    if (relationships.length > 0) {
      const metadata = JSON.parse(relationships[0].metadata || '{}');
      console.log('📋 Review decision:', metadata.decision);
      console.log('📋 Review content preview:', metadata.review?.substring(0, 50) + '...');
    }

    console.log('🎉 Workflow integration test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

testWorkflow();