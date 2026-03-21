-- ============================================================
-- 신사닥터스 업무관리 시스템 — Supabase SQL 설정
-- Supabase > SQL Editor > New Query 에 붙여넣고 실행하세요
-- ============================================================

-- 1. 사용자 테이블
CREATE TABLE IF NOT EXISTS sd_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  job_title TEXT,
  pw TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  approved BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 업무 테이블
CREATE TABLE IF NOT EXISTS sd_tasks (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  person TEXT NOT NULL,
  tagged_users JSONB DEFAULT '[]',
  status TEXT DEFAULT '시작전',
  start_date TEXT,
  due_date TEXT,
  memo TEXT DEFAULT '',
  files JSONB DEFAULT '[]',
  admin_confirmed BOOLEAN DEFAULT false,
  admin_confirmed_at TEXT,
  admin_confirmed_by TEXT,
  admin_only BOOLEAN DEFAULT false,
  comments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 일일보고 테이블
CREATE TABLE IF NOT EXISTS sd_reports (
  id BIGINT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT DEFAULT '일일보고',
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  author TEXT NOT NULL,
  files JSONB DEFAULT '[]',
  task_tags JSONB DEFAULT '[]',
  comments JSONB DEFAULT '[]',
  admin_only BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 시스템 설정 테이블 (PIN 등)
CREATE TABLE IF NOT EXISTS sd_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 5. 알림 로그 테이블
CREATE TABLE IF NOT EXISTS sd_notif_log (
  id BIGINT PRIMARY KEY,
  task_name TEXT,
  person TEXT,
  method TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Row Level Security 활성화
ALTER TABLE sd_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sd_notif_log ENABLE ROW LEVEL SECURITY;

-- 7. 정책: anon key로 전체 접근 허용 (앱 레벨에서 인증 처리)
CREATE POLICY "allow_all_sd_users" ON sd_users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sd_tasks" ON sd_tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sd_reports" ON sd_reports FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sd_settings" ON sd_settings FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sd_notif" ON sd_notif_log FOR ALL TO anon USING (true) WITH CHECK (true);

-- 8. 기본 관리자 계정 삽입
INSERT INTO sd_users (id, name, email, phone, job_title, pw, role, approved)
VALUES ('admin', '관리자', 'admin@sinsa.kr', '010-0000-0000', '관리자', 'Admin1234!', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- 9. 기본 PIN 설정
INSERT INTO sd_settings (key, value) VALUES ('pin', '123456')
ON CONFLICT (key) DO NOTHING;

-- 완료! 아래 SELECT로 확인하세요
SELECT 'sd_users' as table_name, count(*) FROM sd_users
UNION ALL SELECT 'sd_tasks', count(*) FROM sd_tasks
UNION ALL SELECT 'sd_reports', count(*) FROM sd_reports
UNION ALL SELECT 'sd_settings', count(*) FROM sd_settings;
