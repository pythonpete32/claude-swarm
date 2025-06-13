# Create Planning Documents

Collaborate with me to create well-thought-out planning documents through iterative discussion and refinement.

**Usage**: `/project:create-plan $IDEA`

## Purpose

Before decomposing work into issues, let's think deeply about what we're building. This command helps create the planning documents that will feed into issue creation.

## Process

### 1. Initial Exploration

Tell me your idea and I'll help shape it through questions:

```bash
/project:create-plan $IDEA="I want to build a task management app with AI"
```

### 2. Discovery & Analysis

First, I'll check what already exists:
- Scan for existing documentation
- Look for previous design decisions
- Check CLAUDE.md for project context

Then we'll explore key decisions together:
- **Problem space**: What specific problem are we solving?
- **Users**: Who needs this and why?
- **Tech stack**: What languages, frameworks, and tools?
- **Architecture**: How should we structure this?
- **Constraints**: What limitations do we have?

### 3. Collaborative Document Creation

**Important**: I won't just generate documents. We'll build them together through discussion.

As our conversation progresses, I'll draft sections and ask for your input:

"Here's my understanding of the problem statement. Does this capture what you're thinking?"

"For the tech stack, I'm suggesting [X] because [Y]. What are your thoughts?"

We'll iterate until you're confident in each piece.

### 4. Final Documents

Together we'll create:

**planning/PRD.md**
- Problem statement
- User stories
- Success metrics
- Tech stack decision

**planning/architecture.md**
- System design
- Component breakdown
- Data flow
- Technology rationale

**planning/api-spec.yaml** (if applicable)
- Endpoints
- Schemas
- Authentication

## Key Behaviors

- **Check first**: Look for existing docs and context
- **Ask thorough questions**: Nail down all critical decisions
- **Draft collaboratively**: You review and refine every section
- **Think long-term**: Consider maintenance and evolution
- **Document rationale**: Capture not just decisions but *why*

## Output

By the end, you'll have:
- Planning documents you've reviewed and trust
- Clear rationale for all major decisions
- Solid foundation for issue decomposition
- Confidence that we're building the right thing

Remember: These documents set the trajectory for everything that follows. Getting them right is worth the time.