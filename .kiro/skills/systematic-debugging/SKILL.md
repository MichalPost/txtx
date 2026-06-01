---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully** — stack traces, line numbers, error codes
2. **Reproduce Consistently** — can you trigger it reliably?
3. **Check Recent Changes** — git diff, recent commits, new dependencies
4. **Gather Evidence in Multi-Component Systems**

   For each component boundary, add diagnostic instrumentation:
   - Log what data enters/exits each component
   - Verify environment/config propagation
   - Run once to gather evidence showing WHERE it breaks

5. **Trace Data Flow** — where does bad value originate? Keep tracing up until you find the source.

### Phase 2: Pattern Analysis

1. Find working examples of similar code in the codebase
2. Compare against references — read COMPLETELY, don't skim
3. Identify differences, however small
4. Understand dependencies and assumptions

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — "I think X is the root cause because Y"
2. **Test Minimally** — smallest possible change, one variable at a time
3. **Verify Before Continuing** — did it work? If not, form NEW hypothesis
4. **When You Don't Know** — say so, ask for help, research more

### Phase 4: Implementation

1. **Create Failing Test Case** — simplest possible reproduction
2. **Implement Single Fix** — address root cause, ONE change at a time
3. **Verify Fix** — test passes, no other tests broken
4. **If Fix Doesn't Work** — count attempts. If ≥ 3: STOP and question the architecture

**If 3+ Fixes Failed:** Each fix revealing new problem in different place = architectural problem. Discuss with your human partner before attempting more fixes.

## Red Flags — STOP and Follow Process

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "It's probably X, let me fix that"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- **Each fix reveals new problem in different place**

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. |
| "Emergency, no time for process" | Systematic is FASTER than guess-and-check. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+) | 3+ failures = architectural problem. |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |
