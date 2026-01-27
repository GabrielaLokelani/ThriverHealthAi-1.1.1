#!/usr/bin/env node

/**
 * Script to delete a user from AWS Cognito User Pool
 * Usage: node scripts/delete-user.js <email>
 */

import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputs = JSON.parse(readFileSync(join(__dirname, '../amplify_outputs.json'), 'utf-8'));

const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Email address is required');
  console.log('Usage: node scripts/delete-user.js <email>');
  process.exit(1);
}

const userPoolId = outputs.auth.user_pool_id;
const region = outputs.auth.aws_region;

console.log(`🗑️  Deleting user: ${email}`);
console.log(`📍 User Pool ID: ${userPoolId}`);
console.log(`🌍 Region: ${region}`);

const client = new CognitoIdentityProviderClient({ region });

async function deleteUser() {
  try {
    const command = new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: email, // In Cognito, username is the email when email is used as username
    });

    await client.send(command);
    console.log(`✅ Successfully deleted user: ${email}`);
    
    // Also clear localStorage if running in browser context
    console.log('\n💡 Note: You may also want to clear browser localStorage:');
    console.log('   localStorage.removeItem("userProfile")');
    console.log('   localStorage.removeItem("profileCompleted")');
    console.log('   localStorage.removeItem("policyAcceptance")');
    
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      console.log(`⚠️  User ${email} not found in User Pool`);
    } else {
      console.error('❌ Error deleting user:', error.message);
      console.error(error);
    }
    process.exit(1);
  }
}

deleteUser();

