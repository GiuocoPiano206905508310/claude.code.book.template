// ============================================================================
// Supabaseクライアントの初期化
// anon/publicキーはRLS（行レベルセキュリティ）を前提に公開される設計のキーであり、
// クライアント側コードに含めて問題ない。service_roleキー（秘密鍵）は絶対に
// ここに書かないこと。
// ============================================================================

const SUPABASE_URL = 'https://bvokxhtmgfeevfpfafqk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2b2t4aHRtZ2ZlZXZmcGZhZnFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTcxNzUsImV4cCI6MjEwMDA5MzE3NX0.qI5hA2ZV85ZpxFVCqZ5J46PciYa8udCRev3RQcJfWTM';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
