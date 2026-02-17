import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'documents',
  access: (allow) => ({
    'documents/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});
