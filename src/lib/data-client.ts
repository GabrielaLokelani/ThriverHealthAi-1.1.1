// Amplify Data Client
// This file will be updated after running: npm run amplify:generate
// 
// After deployment, uncomment and use:

/*
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

export const dataClient = generateClient<Schema>({
  authMode: "userPool",
});
*/

// Example usage:
/*
import { dataClient } from '@/lib/data-client';

// List all goals for the current user
const { data: goals } = await dataClient.models.Goal.list();

// Create a new goal
const { data: newGoal } = await dataClient.models.Goal.create({
  title: "My Goal",
  description: "Goal description",
  completed: false,
});

// Update a goal
const { data: updatedGoal } = await dataClient.models.Goal.update({
  id: goalId,
  completed: true,
});

// Delete a goal
await dataClient.models.Goal.delete({ id: goalId });
*/

// Placeholder export for now
export const dataClient = null as any;

