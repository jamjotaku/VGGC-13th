import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeXHandle,
  isXHandleMatchingCircle,
  extractXHandleFromUser,
  normalizeInviteCode,
  getAuthMethodLabel,
  normalizeXPostUrl,
  extractTextFromOembedHtml,
  generatePostVerifyCode,
  verifyOembedPayload
} from '../src/utils/circleAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('=== VGGC 13th サークル認証・売り子招待コード 自動テスト ===');

// 1. X ハンドル正規化テスト
assert.equal(normalizeXHandle('@Jamj__Otaku'), 'jamj__otaku');
assert.equal(normalizeXHandle('https://x.com/Jamj__Otaku?s=20'), 'jamj__otaku');
assert.equal(normalizeXHandle('https://twitter.com/Test_User/status/123'), 'test_user');
assert.equal(normalizeXHandle('  '), '');
console.log('  ✅ [PASS] Xハンドル正規化（@除去・URL抽出・小文字統一）');

// 2. サークル名簿との照合テスト
const sampleExtra = {
  twitter_id: '@BlackStance_JP, https://x.com/Jamj__Otaku',
  staff_twitter: '@Staff_One'
};
assert.equal(isXHandleMatchingCircle(sampleExtra, 'jamj__otaku'), true);
assert.equal(isXHandleMatchingCircle(sampleExtra, '@STAFF_ONE'), true);
assert.equal(isXHandleMatchingCircle(sampleExtra, '@other_user'), false);
assert.equal(isXHandleMatchingCircle(null, '@jamj__otaku'), false);
console.log('  ✅ [PASS] サークル登録Xアカウントとの一致判定（複数アカウント・大小文字対応）');

// 3. Supabase user オブジェクトからの X ハンドル抽出
const mockUser = {
  id: 'u1',
  identities: [
    { provider: 'email', identity_data: {} },
    { provider: 'twitter', identity_data: { user_name: 'SampleCircle_X' } }
  ]
};
assert.equal(extractXHandleFromUser(mockUser), 'samplecircle_x');
assert.equal(extractXHandleFromUser({ id: 'u2', identities: [] }), '');
console.log('  ✅ [PASS] Supabase Auth ユーザーからの X ハンドル抽出');

// 4. 売り子招待コード正規化・バリデーション
assert.equal(normalizeInviteCode(' vc-a1b2-c3d4 '), 'VC-A1B2-C3D4');
assert.equal(normalizeInviteCode('VC-123-456'), '');
assert.equal(normalizeInviteCode('INVALID'), '');
console.log('  ✅ [PASS] 売り子用招待コード形式チェック（VC-XXXX-XXXX）');

// 5. 認証方式ラベル
assert.equal(getAuthMethodLabel('x_oauth'), 'X (Twitter) 本人確認');
assert.equal(getAuthMethodLabel('staff_invite_code'), '売り子招待コード');
console.log('  ✅ [PASS] 監査ログ用認証方式ラベル');

// 6. Supabase SQL スキーマ・RPC・RLS 存在確認
const sqlPath = path.join(rootDir, 'supabase', 'circle_auth.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
for (const token of [
  'CREATE TABLE IF NOT EXISTS public.circle_memberships',
  'CREATE TABLE IF NOT EXISTS public.circle_invite_codes',
  'ENABLE ROW LEVEL SECURITY',
  'verify_circle_owner_by_x',
  'create_staff_invite_code',
  'redeem_staff_invite_code',
  'revoke_my_circle_membership'
]) {
  assert.ok(sql.includes(token), `Missing SQL definition: ${token}`);
}
console.log('  ✅ [PASS] supabase/circle_auth.sql のテーブル・RLS・RPC 定義検証');

// 7. ポストURL正規化 & oEmbed 検証テスト
assert.equal(
  normalizeXPostUrl('https://x.com/Jamj__Otaku/status/1857000000000000000?s=20'),
  'https://twitter.com/Jamj__Otaku/status/1857000000000000000'
);
assert.equal(normalizeXPostUrl('https://example.com/status/123'), '');
assert.equal(normalizeXPostUrl('https://x.com/Jamj__Otaku'), '');

const genCode = generatePostVerifyCode();
assert.match(genCode, /^VGGC13-[A-Z0-9]{6}$/);

const mockOembed = {
  author_url: 'https://twitter.com/Jamj__Otaku',
  html: '<blockquote class="twitter-tweet"><p lang="ja" dir="ltr">VGGC 13th 認証コード: ' + genCode + ' <a href="https://t.co/xxx">#VGGC13th</a></p>&mdash; じゃむじゃ (@Jamj__Otaku)</blockquote>'
};
const extractedText = extractTextFromOembedHtml(mockOembed.html);
assert.ok(extractedText.includes(genCode));

const okVerify = verifyOembedPayload(mockOembed, genCode, sampleExtra);
assert.equal(okVerify.ok, true);
assert.equal(okVerify.authorHandle, 'jamj__otaku');

const badCodeVerify = verifyOembedPayload(mockOembed, 'VGGC13-WRONG1', sampleExtra);
assert.equal(badCodeVerify.ok, false);
assert.equal(badCodeVerify.error, 'VERIFY_CODE_NOT_FOUND');

const badHandleVerify = verifyOembedPayload(
  { ...mockOembed, author_url: 'https://twitter.com/unknown_user' },
  genCode,
  sampleExtra
);
assert.equal(badHandleVerify.ok, false);
assert.equal(badHandleVerify.error, 'X_HANDLE_MISMATCH');
console.log('  ✅ [PASS] ポストURL正規化・oEmbed本文抽出・本人照合ロジック検証');

console.log('✅ 全てのサークル認証テストに合格しました！');
