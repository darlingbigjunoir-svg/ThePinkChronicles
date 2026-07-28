/* ============================================================
   THE PINK CHRONICLES — hub-auth.js
   Shared member authentication for every "hub" page
   (dashboard.html, discussions.html, events.html, members.html,
   settings.html). Include this AFTER supabase-config.js and
   BEFORE any page-specific script.
   ============================================================ */
'use strict';

let HUB_MEMBER = null; // the logged-in member's row from `members`, once loaded

/* Call this at the top of every hub page. Redirects to login.html
   if there's no session, or if the session doesn't belong to an
   active joined member (e.g. the admin deactivated the account). */
async function hubRequireMember() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = sessionData && sessionData.session;
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }

  const { data: member, error } = await supabaseClient
    .from('members')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .single();

  if (error || !member || member.status !== 'active') {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html?reason=notmember';
    return null;
  }

  HUB_MEMBER = member;
  return member;
}

async function hubLogout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

/* Small helper other hub scripts can use once HUB_MEMBER is loaded */
function hubMemberDisplayName() {
  if (!HUB_MEMBER) return 'Friend';
  return HUB_MEMBER.nickname || HUB_MEMBER.name || 'Friend';
}