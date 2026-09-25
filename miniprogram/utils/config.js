// 与 iOS 端 SupabaseConfig / ComplianceConfig 保持一致。
// anon key 是公开的只读凭据，数据权限由数据库 RLS 与 grant 控制。
module.exports = {
  supabaseUrl: 'https://gphynosbfjcyexhkgctf.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaHlub3NiZmpjeWV4aGtnY3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzg3ODQsImV4cCI6MjA5MTc1NDc4NH0.0QtUhSnGn0wPwVjyjkPdCIaebIaCvvcVw9AAjtEY9_8',

  legalBase: 'https://duskecho.com/skiller',
  feedbackEmail: 'handwanly@gmail.com',

  // 小程序备案号，与 App 备案号不同；备案通过后填入，为空时不展示。
  icpFilingNumber: '',
}
