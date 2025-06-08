export interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export interface IssuePreview {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  technicalNotes?: string; // Optional
}

// Initial state for a new issue creation session
export const initialAIChatHistory: AIChatMessage[] = [
  {
    id: 'ai_prompt_1',
    sender: 'ai',
    text: "Hello! I'm here to help you create a new GitHub issue. Please describe the task or problem you'd like to address."
  },
  // { id: 'user_1', sender: 'user', text: "The login button is misaligned on mobile." },
  // { id: 'ai_resp_1', sender: 'ai', text: "Okay, I can help with that. To clarify, could you tell me more about where it's misaligned (e.g., left, right, overlapping other elements) and on what mobile screen sizes?" }
];

export const initialIssuePreview: IssuePreview = {
  title: "",
  description: "",
  acceptanceCriteria: [],
  technicalNotes: "",
};

// Example of an updated preview after some interaction
export const sampleUpdatedIssuePreview: IssuePreview = {
  title: "Fix login button misalignment on mobile devices",
  description: "The primary login button on the authentication page is currently misaligned on mobile screen sizes (less than 600px width), appearing partially off-screen to the right.",
  acceptanceCriteria: [
    "Login button is fully visible and correctly centered on screen widths below 600px.",
    "Button text is not truncated.",
    "Button maintains standard tap target size.",
  ],
  technicalNotes: "Investigate CSS for .auth-container and .login-button. Potential flexbox or media query issue. Test on emulated iPhone SE and Galaxy S5 views.",
};

export const sampleUserQuery = "The login button is off to the side on small screens.";
export const sampleAIResponse = "Understood. Based on that, here's a draft for the issue. You can refine it further or ask me to make changes.";
