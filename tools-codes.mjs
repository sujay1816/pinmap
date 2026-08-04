// Print a batch of recharge codes to hand out.
//   node tools-codes.mjs 50 20     -> twenty codes worth 50 credits each
import { makeCodes } from './tests/core.mjs';
const amount = parseInt(process.argv[2] || '50', 10);
const count  = parseInt(process.argv[3] || '10', 10);
if (!amount || !count) { console.error('usage: node tools-codes.mjs <credits> <how many>'); process.exit(1); }
console.log(`# ${count} codes, ${amount} credits each`);
console.log('# each one works once per account. Keep a note of who gets which.\n');
makeCodes(amount, count).forEach((c,i) => console.log(String(i+1).padStart(3) + '  ' + c));
