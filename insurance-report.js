// ============================================================================
// 算定基礎届・月額変更届についての解説ページ（表示のみ）
// ============================================================================

(async () => {
  const user = await requireAuth();
  if (!user) return;
  renderNavbar('insurance-report.html');
  renderNavbarUser(user);
})();
