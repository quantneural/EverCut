/**
 * Token Verification Test
 * Tests generated tokens against the authentication middleware
 */

import admin from '../src/config/firebase.config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyToken(token, role) {
  try {
    console.log(`\n🔍 Verifying ${role} token...`);
    
    // This mimics what the authenticate middleware does
    const decoded = await admin.auth().verifyIdToken(token);
    
    console.log('✅ Token is VALID!');
    console.log('   User ID:', decoded.uid);
    console.log('   Email:', decoded.email);
    console.log('   Phone:', decoded.phone_number);
    console.log('   Role (custom claim):', decoded.role);
    console.log('   Issued at:', new Date(decoded.iat * 1000).toISOString());
    console.log('   Expires at:', new Date(decoded.exp * 1000).toISOString());
    
    return true;
  } catch (error) {
    console.log('❌ Token is INVALID!');
    console.log('   Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔐 Token Verification Test');
  console.log('═'.repeat(60));
  
  // Read tokens from test-tokens.json
  const tokensPath = path.join(__dirname, 'test-tokens.json');
  
  if (!fs.existsSync(tokensPath)) {
    console.error('❌ test-tokens.json not found. Run a token generator script first.');
    process.exit(1);
  }
  
  const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
  
  console.log('Generated at:', tokensData.generatedAt);
  console.log('Expires at:', tokensData.expiresAt);
  
  let allValid = true;
  
  // Verify customer token
  if (tokensData.tokens['test-customer-001']) {
    const customerToken = tokensData.tokens['test-customer-001'].idToken;
    const isValid = await verifyToken(customerToken, 'CUSTOMER');
    allValid = allValid && isValid;
  }
  
  // Verify barber token
  if (tokensData.tokens['test-barber-001']) {
    const barberToken = tokensData.tokens['test-barber-001'].idToken;
    const isValid = await verifyToken(barberToken, 'BARBER');
    allValid = allValid && isValid;
  }
  
  console.log('\n' + '═'.repeat(60));
  if (allValid) {
    console.log('✅ All tokens are valid and working correctly!');
  } else {
    console.log('❌ Some tokens failed verification.');
  }
}

main().catch(console.error);
