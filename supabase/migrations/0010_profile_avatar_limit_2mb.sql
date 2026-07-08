-- ─────────────────────────────────────────────────────────────
-- 0010_profile_avatar_limit_2mb.sql — align profile image limit with UI/server actions
-- ─────────────────────────────────────────────────────────────

update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'profile-images';
