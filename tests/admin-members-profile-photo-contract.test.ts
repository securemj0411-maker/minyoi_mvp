import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ROOT = new URL("../", import.meta.url);

function source(path: string) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

test("admin members page forwards Kakao/Supabase profile photo URLs to the drawer", () => {
  const page = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/page.tsx");
  const table = source("src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/members-table.tsx");

  assert.match(page, /identities\?: Array<\{ identity_data\?: AuthUserMetadata \| null \}> \| null/);
  assert.match(page, /"avatar_url"/);
  assert.match(page, /"profile_image_url"/);
  assert.match(page, /profileImageUrl: profileImageUrlOf\(u\)/);

  assert.match(table, /profileImageUrl: string \| null/);
  assert.match(table, /function ProfileThumb/);
  assert.match(table, /function ProfilePhotoModal/);
  assert.match(table, /PROFILE PHOTO/);
  assert.match(table, /referrerPolicy="no-referrer"/);
});
