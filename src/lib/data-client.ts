import { generateClient } from 'aws-amplify/data';

// Keep this permissive while schema types are finalized.
export const dataClient = generateClient({
  authMode: 'userPool',
}) as any;

