/**
 * Agent state interfaces for observable state management
 */

export interface CodingAgentState {
  phase: "initializing" | "working" | "review_requested" | "pr_created" | "terminated" | "cleanup";
  reviewCount: number; // Current review cycle count
  maxReviews: number; // Maximum allowed reviews
  currentReviewInstanceId?: string; // Active review agent ID
  lastActivity: Date;

  // Error tracking
  lastError?: string; // Most recent error message
  failureReason?: string; // Reason for termination
}

export interface ReviewAgentState {
  phase: "initializing" | "working" | "request_review" | "pull_request" | "cleanup";
  parentInstanceId: string; // Parent coding agent
  decision?: "request_review" | "pull_request";

  // Decision tracking
  decisionReason?: string; // Explanation of decision
  feedbackDelivered: boolean; // Whether feedback was provided
}
