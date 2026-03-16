async function sawLogout({ cookies }) {
  console.log('[LOGOUT] Sessão encerrada');
  return { success: true, message: 'Logout realizado' };
}
module.exports = sawLogout;
